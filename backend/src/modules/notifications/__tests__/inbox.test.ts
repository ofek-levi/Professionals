import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer } from '../../../../test/auth.js';
import { createOffer, createProfessional, createRequest } from '../../../../test/factories.js';
import { newObjectId } from '../../../lib/ids.js';
import type { AppNotification } from '../../../shared/contract/index.js';
import type { UserDoc } from '../../users/user.model.js';
import { createNotification } from '../create-notification.service.js';
import { NotificationModel } from '../notification.model.js';
import { listRecentNotifications } from '../notifications.service.js';

// One app per file: the model clock (createdAt) is process-wide.
const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
beforeEach(async () => {
  await clearDatabase();
  deps.clock.set('2026-10-01T09:00:00.000Z');
});

/** `count` notifications for `user`, one minute apart (oldest first). */
async function notify(user: Pick<UserDoc, '_id'>, count: number): Promise<AppNotification[]> {
  const { professional } = await createProfessional();
  const serviceRequest = await createRequest(user);
  const offer = await createOffer(serviceRequest, professional);
  const created: AppNotification[] = [];
  for (let i = 0; i < count; i += 1) {
    const notification = await createNotification(deps, user._id, { type: 'offer_received', offer, categoryId: 'plumbing', professionalName: `Pro ${i}` });
    if (notification) created.push(notification);
    deps.clock.advanceMinutes(1);
  }
  return created;
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

/** A `new_message` notification of a new chat (read or not), one minute after the previous one. */
async function chatNotification(user: Pick<UserDoc, '_id'>, read: boolean): Promise<void> {
  const created = await createNotification(deps, user._id, {
    type: 'new_message',
    conversationId: newObjectId(),
    senderRole: 'professional',
    senderName: 'Avi Fix',
    messageText: 'On my way',
    replacesUnread: false,
  });
  if (read && created) await NotificationModel.updateOne({ _id: created.id }, { $set: { readAt: deps.clock.now() } });
  deps.clock.advanceMinutes(1);
}

describe('GET /v1/notifications', () => {
  it('lists the caller’s notifications newest first with keyset pages', async () => {
    const customer = await signInCustomer(deps);
    const other = await signInCustomer(deps);
    const created = (await notify(customer.user, 5)).reverse();
    await notify(other.user, 1);

    const first = await request(app).get('/v1/notifications?limit=2').set(customer.headers).expect(200);
    expect(first.body).toMatchObject({ totalCount: 5, nextCursor: expect.any(String) });
    expect(first.body.items).toEqual(created.slice(0, 2));

    // A newer notification does not shift the following pages.
    await notify(customer.user, 1);
    const second = await request(app).get(`/v1/notifications?limit=2&cursor=${first.body.nextCursor as string}`).set(customer.headers).expect(200);
    expect(ids(second.body.items)).toEqual(ids(created.slice(2, 4)));
    const third = await request(app).get(`/v1/notifications?limit=2&cursor=${second.body.nextCursor as string}`).set(customer.headers).expect(200);
    expect(ids(third.body.items)).toEqual(ids(created.slice(4)));
    expect(third.body.nextCursor).toBeNull();
  });

  it('filters unread only', async () => {
    const customer = await signInCustomer(deps);
    const [read, unread] = await notify(customer.user, 2);
    await request(app).post(`/v1/notifications/${read?.id ?? ''}/read`).set(customer.headers).expect(200);
    const res = await request(app).get('/v1/notifications?unreadOnly=true').set(customer.headers).expect(200);
    expect(res.body).toEqual({ items: [unread], nextCursor: null, totalCount: 1 });
    const all = await request(app).get('/v1/notifications?unreadOnly=false').set(customer.headers).expect(200);
    expect(all.body.totalCount).toBe(2);
  });

  it('leaves out excluded types on every page, however many of them come in between', async () => {
    const customer = await signInCustomer(deps);
    const [older] = await notify(customer.user, 1);
    // Newer: 3 chat notifications (read ones pile up, one per burst of messages) above one update.
    for (let i = 0; i < 3; i += 1) await chatNotification(customer.user, true);
    const [newer] = await notify(customer.user, 1);
    await chatNotification(customer.user, false);

    const first = await request(app).get('/v1/notifications?limit=1&excludeTypes=new_message').set(customer.headers).expect(200);
    expect(first.body).toMatchObject({ items: [newer], totalCount: 2 });
    const second = await request(app)
      .get(`/v1/notifications?limit=1&excludeTypes=new_message&cursor=${first.body.nextCursor as string}`)
      .set(customer.headers)
      .expect(200);
    expect(second.body).toMatchObject({ items: [older], nextCursor: null });
    const unreadUpdates = await request(app).get('/v1/notifications?unreadOnly=true&excludeTypes=new_message').set(customer.headers).expect(200);
    expect(ids(unreadUpdates.body.items)).toEqual(ids([newer, older].filter((item) => item !== undefined)));
    const everything = await request(app).get('/v1/notifications').set(customer.headers).expect(200);
    expect(everything.body.totalCount).toBe(6);
  });

  it('validates the query and requires a session', async () => {
    const customer = await signInCustomer(deps);
    const res = await request(app).get('/v1/notifications?unreadOnly=maybe&limit=101&excludeTypes=new_message,bogus').set(customer.headers).expect(400);
    expect(res.body.fieldErrors).toEqual({ unreadOnly: ['validation:invalid'], limit: ['validation:invalid'], 'excludeTypes.1': ['validation:invalid'] });
    await request(app).get('/v1/notifications').expect(401);
  });
});

describe('GET /v1/notifications/unread-count', () => {
  it('counts the caller’s unread notifications', async () => {
    const customer = await signInCustomer(deps);
    expect((await request(app).get('/v1/notifications/unread-count').set(customer.headers).expect(200)).body).toEqual({ count: 0 });
    await notify(customer.user, 3);
    await notify((await signInCustomer(deps)).user, 2);
    expect((await request(app).get('/v1/notifications/unread-count').set(customer.headers).expect(200)).body).toEqual({ count: 3 });
  });

  it('leaves out excluded types (the app counts chats under Messages), however many unread updates are newer', async () => {
    const customer = await signInCustomer(deps);
    await chatNotification(customer.user, false);
    await chatNotification(customer.user, true);
    await notify(customer.user, 25);
    const count = (query: string) => request(app).get(`/v1/notifications/unread-count${query}`).set(customer.headers).expect(200);
    expect((await count('')).body).toEqual({ count: 26 });
    expect((await count('?excludeTypes=new_message')).body).toEqual({ count: 25 });
    expect((await count('?excludeTypes=new_message,offer_received')).body).toEqual({ count: 0 });
    const invalid = await request(app).get('/v1/notifications/unread-count?excludeTypes=nope').set(customer.headers).expect(400);
    expect(invalid.body.fieldErrors).toEqual({ 'excludeTypes.0': ['validation:invalid'] });
  });
});

describe('POST /v1/notifications/:id/read', () => {
  it('marks it read and is idempotent', async () => {
    const customer = await signInCustomer(deps);
    const [notification] = await notify(customer.user, 1);
    const path = `/v1/notifications/${notification?.id ?? ''}/read`;
    deps.clock.set('2026-10-01T09:20:00.000Z');
    const res = await request(app).post(path).set(customer.headers).expect(200);
    expect(res.body).toEqual({ ...notification, readAt: '2026-10-01T09:20:00.000Z' });

    deps.clock.advanceMinutes(5);
    expect((await request(app).post(path).set(customer.headers).expect(200)).body.readAt).toBe('2026-10-01T09:20:00.000Z');
    expect((await request(app).get('/v1/notifications/unread-count').set(customer.headers).expect(200)).body).toEqual({ count: 0 });
  });

  it('answers 404 for unknown or malformed ids and 403 for another user’s notification', async () => {
    const customer = await signInCustomer(deps);
    const other = await signInCustomer(deps);
    const [theirs] = await notify(other.user, 1);
    await request(app).post(`/v1/notifications/${newObjectId().toHexString()}/read`).set(customer.headers).expect(404);
    await request(app).post('/v1/notifications/abc/read').set(customer.headers).expect(404);
    const forbidden = await request(app).post(`/v1/notifications/${theirs?.id ?? ''}/read`).set(customer.headers).expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
    expect((await request(app).get('/v1/notifications/unread-count').set(other.headers).expect(200)).body).toEqual({ count: 1 });
  });
});

describe('POST /v1/notifications/read-all', () => {
  it('marks every unread notification of the caller read', async () => {
    const customer = await signInCustomer(deps);
    const other = await signInCustomer(deps);
    await notify(customer.user, 3);
    await notify(other.user, 1);
    expect((await request(app).post('/v1/notifications/read-all').set(customer.headers).expect(200)).body).toEqual({ success: true });
    const list = await request(app).get('/v1/notifications').set(customer.headers).expect(200);
    expect((list.body.items as AppNotification[]).every((item) => item.readAt === '2026-10-01T09:04:00.000Z')).toBe(true);
    expect((await request(app).get('/v1/notifications/unread-count').set(other.headers).expect(200)).body).toEqual({ count: 1 });
  });
});

describe('listRecentNotifications (dashboard)', () => {
  it('returns the newest notifications up to the limit', async () => {
    const customer = await signInCustomer(deps);
    const created = await notify(customer.user, 4);
    expect(ids(await listRecentNotifications(customer.user._id, 3))).toEqual(ids(created.reverse().slice(0, 3)));
  });
});
