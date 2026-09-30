import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { newObjectId } from '../../../lib/ids.js';
import { UserModel } from '../../users/user.model.js';
import { createChat, send } from './chat-fixture.js';

// One app per file: the model clock (createdAt/updatedAt) is process-wide.
const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
beforeEach(async () => {
  await clearDatabase();
  deps.clock.set('2026-10-01T09:00:00.000Z');
});

describe('GET /v1/conversations/unread-count', () => {
  it('sums the caller’s unread messages over every conversation (the inbox badge)', async () => {
    const first = await createChat(deps);
    const second = await createChat(deps, { customer: first.customer });
    const count = async (headers: { Authorization: string }) =>
      (await request(app).get('/v1/conversations/unread-count').set(headers).expect(200)).body as { count: number };

    expect(await count(first.customer.headers)).toEqual({ count: 0 });
    await send(app, first, first.pro, 'One');
    await send(app, first, first.pro, 'Two');
    await send(app, second, second.pro, 'Three');
    expect(await count(first.customer.headers)).toEqual({ count: 3 });
    expect(await count(first.pro.headers)).toEqual({ count: 0 });
    // Replying reads the conversation (the app's rule), and the counterpart gets one unread.
    await send(app, second, first.customer, 'Thanks');
    expect(await count(first.customer.headers)).toEqual({ count: 2 });
    expect(await count(second.pro.headers)).toEqual({ count: 1 });

    await request(app).post(`${first.path}/read`).set(first.customer.headers).expect(200);
    expect(await count(first.customer.headers)).toEqual({ count: 0 });
    await request(app).get('/v1/conversations/unread-count').expect(401);
  });
});

describe('GET /v1/conversations', () => {
  it('lists the caller’s conversations, most recent activity first, with participants and unread counts', async () => {
    const older = await createChat(deps);
    deps.clock.advanceMinutes(1);
    const newer = await createChat(deps, { customer: older.customer });
    await UserModel.updateOne({ _id: older.customer.user._id }, { $set: { avatar: { url: 'https://images.test/noa.jpg', publicId: null } } });
    deps.clock.advanceMinutes(1);
    const sent = await send(app, older, older.pro, 'Hi Noa, see you tomorrow');

    const res = await request(app).get('/v1/conversations').set(older.customer.headers).expect(200);
    expect(res.body).toMatchObject({ totalCount: 2, nextCursor: null });
    expect(res.body.items.map((c: { id: string }) => c.id)).toEqual([older.conversationId, newer.conversationId]);
    expect(res.body.items[0]).toEqual({
      id: older.conversationId,
      jobId: older.job._id.toHexString(),
      requestId: older.job.request.toHexString(),
      participants: [
        { userId: older.customer.user._id.toHexString(), role: 'customer', displayName: 'Noa Levi', avatarUrl: 'https://images.test/noa.jpg' },
        { userId: older.pro.user._id.toHexString(), role: 'professional', displayName: 'Avi Fix', avatarUrl: null },
      ],
      lastMessage: {
        id: sent.id,
        conversationId: older.conversationId,
        senderId: older.pro.user._id.toHexString(),
        text: 'Hi Noa, see you tomorrow',
        createdAt: '2026-10-01T09:02:00.000Z',
        readAt: null,
        clientMessageId: sent.clientMessageId,
      },
      unreadCount: 1,
      isOpen: true,
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-01T09:02:00.000Z',
    });
    expect(res.body.items[1]).toMatchObject({ lastMessage: null, unreadCount: 0 });

    // The professional sees only their own conversation, without unread messages of their own.
    const proList = await request(app).get('/v1/conversations').set(older.pro.headers).expect(200);
    expect(proList.body.items.map((c: { id: string; unreadCount: number }) => [c.id, c.unreadCount])).toEqual([[older.conversationId, 0]]);
  });

  it('pages with a stable keyset cursor', async () => {
    const customer = await signInCustomer(deps);
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      ids.unshift((await createChat(deps, { customer })).conversationId);
      deps.clock.advanceMinutes(1);
    }
    const first = await request(app).get('/v1/conversations?limit=2').set(customer.headers).expect(200);
    expect(first.body.items.map((c: { id: string }) => c.id)).toEqual(ids.slice(0, 2));
    expect(first.body.totalCount).toBe(3);

    // A conversation created meanwhile does not shift the next page.
    await createChat(deps, { customer });
    const second = await request(app).get(`/v1/conversations?limit=2&cursor=${first.body.nextCursor as string}`).set(customer.headers).expect(200);
    expect(second.body.items.map((c: { id: string }) => c.id)).toEqual(ids.slice(2));
    expect(second.body.nextCursor).toBeNull();
  });

  it('validates pagination and requires a session', async () => {
    const customer = await signInCustomer(deps);
    const res = await request(app).get('/v1/conversations?limit=0&cursor=nope').set(customer.headers).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { limit: ['validation:invalid'] } });
    const badCursor = await request(app).get('/v1/conversations?cursor=nope').set(customer.headers).expect(400);
    expect(badCursor.body.fieldErrors).toEqual({ cursor: ['validation:invalid'] });
    await request(app).get('/v1/conversations').expect(401);
  });
});

describe('GET /v1/conversations/:id', () => {
  it('returns the conversation to both participants with their own unread count', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.customer, 'Hello');
    const forPro = await request(app).get(chat.path).set(chat.pro.headers).expect(200);
    expect(forPro.body).toMatchObject({ id: chat.conversationId, unreadCount: 1, lastMessage: { text: 'Hello' } });
    const forCustomer = await request(app).get(chat.path).set(chat.customer.headers).expect(200);
    expect(forCustomer.body.unreadCount).toBe(0);
  });

  it('answers 404 for unknown or malformed ids and 403 for non-participants', async () => {
    const chat = await createChat(deps);
    const outsider = await signInProfessional(deps);
    await request(app).get(`/v1/conversations/${newObjectId().toHexString()}`).set(chat.customer.headers).expect(404);
    const malformed = await request(app).get('/v1/conversations/not-an-id').set(chat.customer.headers).expect(404);
    expect(malformed.body).toEqual({ code: 'NOT_FOUND', message: 'Conversation was not found' });
    const forbidden = await request(app).get(chat.path).set(outsider.headers).expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });
});

describe('GET /v1/conversations/:id/messages', () => {
  it('pages messages newest first; new messages do not shift older pages', async () => {
    const chat = await createChat(deps);
    const texts = ['one', 'two', 'three', 'four', 'five'];
    for (const [index, text] of texts.entries()) {
      await send(app, chat, index % 2 === 0 ? chat.customer : chat.pro, text);
      deps.clock.advance(1000);
    }
    const first = await request(app).get(`${chat.path}/messages?limit=2`).set(chat.pro.headers).expect(200);
    expect(first.body.items.map((m: { text: string }) => m.text)).toEqual(['five', 'four']);
    expect(first.body.totalCount).toBe(5);
    expect(first.body.items[0]).toEqual({
      id: expect.any(String),
      conversationId: chat.conversationId,
      senderId: chat.customer.user._id.toHexString(),
      text: 'five',
      createdAt: '2026-10-01T09:00:04.000Z',
      readAt: null,
      clientMessageId: expect.any(String),
    });

    await send(app, chat, chat.pro, 'six');
    const second = await request(app).get(`${chat.path}/messages?limit=2&cursor=${first.body.nextCursor as string}`).set(chat.pro.headers).expect(200);
    expect(second.body.items.map((m: { text: string }) => m.text)).toEqual(['three', 'two']);
    const third = await request(app).get(`${chat.path}/messages?limit=2&cursor=${second.body.nextCursor as string}`).set(chat.pro.headers).expect(200);
    // `totalCount` is counted on the first page and echoed by later ones (no recount per page).
    expect(third.body).toMatchObject({ nextCursor: null, totalCount: 5 });
    expect(third.body.items.map((m: { text: string }) => m.text)).toEqual(['one']);
  });

  it('is only readable by participants', async () => {
    const chat = await createChat(deps);
    const outsider = await signInCustomer(deps);
    await request(app).get(`${chat.path}/messages`).set(outsider.headers).expect(403);
    await request(app).get(`/v1/conversations/${newObjectId().toHexString()}/messages`).set(chat.customer.headers).expect(404);
    await request(app).get(`${chat.path}/messages`).expect(401);
  });
});
