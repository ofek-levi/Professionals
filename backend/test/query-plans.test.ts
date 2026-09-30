/**
 * Query plans of the hottest lists, measured with MongoDB's profiler on the real endpoints: a page
 * deep inside a long list must read about `limit` index keys (the cursor is an index bound, not a
 * filter applied while scanning from the top), never sort in memory, and never recount the list.
 * Filler documents only carry the indexed fields: a correct plan never fetches them.
 */
import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { encodeCursor } from '../src/lib/pagination.js';
import { ConversationModel } from '../src/modules/conversations/conversation.model.js';
import { JobModel } from '../src/modules/jobs/job.model.js';
import { MessageModel } from '../src/modules/conversations/message.model.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { OfferModel } from '../src/modules/offers/offer.model.js';
import { UploadModel } from '../src/modules/uploads/upload.model.js';
import { createChat } from '../src/modules/conversations/__tests__/chat-fixture.js';
import { JOB_STATUSES, OFFER_STATUSES } from '../src/shared/statuses.js';
import { clearDatabase, createTestApp } from './app.js';
import { signInCustomer, signInProfessional } from './auth.js';
import { createJob, createOffer, createRequest } from './factories.js';
import { on, profiled, type ProfiledOp } from './query-profile.js';

const MINUTE = 60_000;
const FILLER = 300;

/** `countDocuments` runs as an aggregation ending in `{$group: {_id: 1, n: {$sum: 1}}}`. */
function isCount(op: ProfiledOp): boolean {
  return JSON.stringify(op.command.pipeline ?? []).includes('"n":{"$sum":1}');
}

/** The page query of a cursor page: bounded by the index, no in-memory sort, and no recount. */
function expectIndexBoundedPage(ops: ProfiledOp[], collection: string, maxKeys: number): void {
  const pages = on(ops, collection, 'query').filter((op) => 'find' in op.command);
  expect(pages, `${collection}: one page query`).toHaveLength(1);
  expect(on(ops, collection).filter(isCount), `${collection}: no count on a cursor page`).toEqual([]);
  const [page] = pages;
  expect(page?.planSummary).toMatch(/IXSCAN/);
  expect(page?.hasSortStage ?? false, `${collection}: no blocking sort`).toBe(false);
  expect(page?.keysExamined, `${collection}: keys examined`).toBeLessThanOrEqual(maxKeys);
}

describe('query plans of deep cursor pages', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);
  const at = (minutes: number) => new Date(deps.clock.now().getTime() + minutes * MINUTE);

  it('notifications (all and unread only)', async () => {
    const [me, other] = [await signInCustomer(deps), await signInCustomer(deps)];
    const docs = [me, other].flatMap(({ user }) =>
      Array.from({ length: FILLER }, (_, i) => ({
        _id: new Types.ObjectId(),
        user: user._id,
        type: 'new_matching_request',
        params: {},
        target: { kind: 'none' },
        readAt: i % 2 === 0 ? null : at(i),
        createdAt: at(i),
      })),
    );
    await NotificationModel.collection.insertMany(docs);
    const mine = docs.filter((doc) => doc.user.equals(me.user._id)).reverse(); // newest first
    const deep = mine[250];
    const unreadDeep = mine.filter((doc) => doc.readAt === null)[120];
    if (!deep || !unreadDeep) throw new Error('fixture');

    const all = await profiled(() =>
      request(app)
        .get('/v1/notifications')
        .query({ limit: 20, cursor: encodeCursor({ values: [deep.createdAt, deep._id], totalCount: FILLER }) })
        .set(me.headers)
        .expect(200),
    );
    expectIndexBoundedPage(all, 'notifications', 22);

    const unread = await profiled(() =>
      request(app)
        .get('/v1/notifications')
        .query({ unreadOnly: 'true', limit: 20, cursor: encodeCursor({ values: [unreadDeep.createdAt, unreadDeep._id], totalCount: 150 }) })
        .set(me.headers)
        .expect(200),
    );
    expectIndexBoundedPage(unread, 'notifications', 22);
  });

  it('chat messages ("load older")', async () => {
    const chat = await createChat(deps);
    const conversation = new Types.ObjectId(chat.conversationId);
    const docs = Array.from({ length: FILLER }, (_, i) => ({
      _id: new Types.ObjectId(),
      conversation,
      sender: i % 2 === 0 ? chat.customer.user._id : chat.pro.user._id,
      text: `message ${i}`,
      clientMessageId: `seed-${i}`,
      readAt: null,
      createdAt: at(i),
    }));
    await MessageModel.collection.insertMany(docs);
    const deep = docs[40];
    if (!deep) throw new Error('fixture');
    const ops = await profiled(() =>
      request(app)
        .get(`${chat.path}/messages`)
        .query({ limit: 20, cursor: encodeCursor({ values: [deep.createdAt, deep._id], totalCount: FILLER }) })
        .set(chat.customer.headers)
        .expect(200),
    );
    expectIndexBoundedPage(ops, 'messages', 22);
  });

  it("a professional's jobs (scope=all: every status merged in appointment order)", async () => {
    const pro = await signInProfessional(deps);
    const customer = await signInCustomer(deps);
    const fillers = Array.from({ length: FILLER }, (_, i) => ({
      _id: new Types.ObjectId(),
      request: new Types.ObjectId(),
      professional: pro.user._id,
      customer: customer.user._id,
      status: JOB_STATUSES[i % JOB_STATUSES.length],
      scheduledStartAt: at(10 * 24 * 60 + i),
    }));
    await JobModel.collection.insertMany(fillers);
    for (let i = 0; i < 5; i += 1) {
      const serviceRequest = await createRequest(customer.user);
      await createJob(serviceRequest, await createOffer(serviceRequest, pro.professional, { status: 'accepted' }));
    }
    const earliestFiller = fillers[0];
    if (!earliestFiller) throw new Error('fixture');
    const cursor = encodeCursor({ values: [earliestFiller.scheduledStartAt, earliestFiller._id], totalCount: FILLER + 5 });
    let page: { items: unknown[] } = { items: [] };
    const ops = await profiled(async () => {
      page = (await request(app).get('/v1/jobs').query({ scope: 'all', limit: 3, cursor }).set(pro.headers).expect(200)).body as typeof page;
    });
    expect(page.items).toHaveLength(3);
    // 4 fetched + at most one boundary key per status branch.
    expectIndexBoundedPage(ops, 'jobs', 4 + JOB_STATUSES.length + 2);
  });

  it("a professional's offers (every status merged in update order)", async () => {
    const pro = await signInProfessional(deps);
    const customer = await signInCustomer(deps);
    for (let i = 0; i < 4; i += 1) await createOffer(await createRequest(customer.user), pro.professional);
    const fillers = Array.from({ length: FILLER }, (_, i) => ({
      _id: new Types.ObjectId(),
      professional: pro.user._id,
      request: new Types.ObjectId(),
      status: OFFER_STATUSES[i % OFFER_STATUSES.length],
      updatedAt: at(24 * 60 + i),
    }));
    await OfferModel.collection.insertMany(fillers);
    const oldestFiller = fillers[0];
    if (!oldestFiller) throw new Error('fixture');
    const cursor = encodeCursor({ values: [oldestFiller.updatedAt, oldestFiller._id], totalCount: FILLER + 4 });
    const ops = await profiled(() => request(app).get('/v1/professional/offers').query({ limit: 3, cursor }).set(pro.headers).expect(200));
    expectIndexBoundedPage(ops, 'offers', 4 + OFFER_STATUSES.length + 2);
  });
});

describe('query plans of dashboard previews', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('pending offers are read in index order and jobs awaiting a review skip reviewed ones', async () => {
    const pro = await signInProfessional(deps);
    const customer = await signInCustomer(deps);
    await OfferModel.collection.insertMany(
      Array.from({ length: FILLER }, (_, i) => ({ professional: pro.user._id, request: new Types.ObjectId(), status: 'pending', updatedAt: new Date(i) })),
    );
    for (let i = 0; i < 5; i += 1) await createOffer(await createRequest(customer.user), pro.professional);
    const proOps = await profiled(() => request(app).get('/v1/professional/dashboard').set(pro.headers).expect(200));
    const preview = on(proOps, 'offers', 'query').find((op) => 'sort' in op.command);
    expect(preview?.hasSortStage ?? false).toBe(false);
    expect(preview?.keysExamined).toBeLessThanOrEqual(6);

    await JobModel.collection.insertMany(
      Array.from({ length: FILLER }, (_, i) => ({
        request: new Types.ObjectId(),
        customer: customer.user._id,
        status: 'completed',
        completedAt: new Date(i),
        review: new Types.ObjectId(),
      })),
    );
    const serviceRequest = await createRequest(customer.user);
    await createJob(serviceRequest, await createOffer(serviceRequest, pro.professional, { status: 'accepted' }), {
      status: 'completed',
      completedAt: deps.clock.now(),
    });
    const customerOps = await profiled(() => request(app).get('/v1/customer/dashboard').set(customer.headers).expect(200));
    const awaiting = on(customerOps, 'jobs', 'query').find((op) => JSON.stringify(op.command).includes('"review":null'));
    expect(JSON.stringify(awaiting?.execStats)).toContain('"indexName":"customer_awaiting_review"');
    expect([awaiting?.keysExamined, awaiting?.docsExamined]).toEqual([1, 1]);
  });
});

describe('query plans of per-user counters', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('the inbox badge reads only the conversations with unread messages', async () => {
    const customer = await signInCustomer(deps);
    const partner = new Types.ObjectId();
    await ConversationModel.collection.insertMany(
      Array.from({ length: FILLER }, (_, i) => ({
        job: new Types.ObjectId(),
        request: new Types.ObjectId(),
        categoryId: 'plumbing',
        participants: [
          { user: customer.user._id, role: 'customer', unreadCount: i < 3 ? 2 : 0 },
          { user: partner, role: 'professional', unreadCount: 1 },
        ],
        lastMessage: null,
        lastActivityAt: new Date(i),
        isOpen: true,
      })),
    );
    let body: unknown;
    const ops = await profiled(async () => {
      body = (await request(app).get('/v1/conversations/unread-count').set(customer.headers).expect(200)).body;
    });
    expect(body).toEqual({ count: 6 });
    const [query] = on(ops, 'conversations', 'query');
    expect(JSON.stringify(query?.execStats)).toContain('"indexName":"participant_unread"');
    expect(query?.docsExamined).toBe(3);
    expect(query?.keysExamined).toBeLessThanOrEqual(4);
  });

  it('the upload quota counts only the caller’s unattached uploads', async () => {
    const customer = await signInCustomer(deps);
    await UploadModel.collection.insertMany(
      Array.from({ length: FILLER }, (_, i) => ({
        owner: customer.user._id,
        publicId: `p${i}`,
        url: `https://images.test/${i}.jpg`,
        width: null,
        height: null,
        attachedAt: i < 5 ? null : new Date(i),
        createdAt: new Date(i),
      })),
    );
    const ops = await profiled(() =>
      request(app).post('/v1/uploads/images').set(customer.headers).attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), 'a.jpg').expect(201),
    );
    // `countDocuments` is an aggregation: its profile has the plan summary, not the stages.
    const count = on(ops, 'uploads').find((op) => JSON.stringify(op.command).includes('"$type":"null"'));
    // The partial index holds only unattached uploads, so MongoDB counts its keys without fetching.
    expect(count?.planSummary).toBe('COUNT_SCAN { owner: 1 }');
    expect(count?.keysExamined).toBeLessThanOrEqual(6);
  });
});
