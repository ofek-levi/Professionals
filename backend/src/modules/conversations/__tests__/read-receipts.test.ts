import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInProfessional } from '../../../../test/auth.js';
import { newObjectId } from '../../../lib/ids.js';
import { NotificationModel } from '../../notifications/notification.model.js';
import { MessageModel } from '../message.model.js';
import { createChat, send } from './chat-fixture.js';

// One app per file: the model clock (createdAt/updatedAt) is process-wide.
const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
beforeEach(async () => {
  await clearDatabase();
  deps.clock.set('2026-10-01T09:00:00.000Z');
  deps.realtime.clear();
});

describe('POST /v1/conversations/:id/read', () => {
  it('marks the counterpart’s messages read and sends the receipt to both participants', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.customer, 'Hi, when do you come?');
    deps.clock.advanceMinutes(1);
    await send(app, chat, chat.pro, 'Arriving at 10');
    await send(app, chat, chat.pro, 'Is parking available?');
    deps.clock.advanceMinutes(2);
    deps.realtime.clear();

    const res = await request(app).post(`${chat.path}/read`).set(chat.customer.headers).expect(200);
    expect(res.body).toEqual({ success: true });

    const receipt = {
      type: 'conversation.read',
      conversationId: chat.conversationId,
      readerId: chat.customer.user._id.toHexString(),
      readAt: '2026-10-01T09:03:00.000Z',
    };
    expect(deps.realtime.eventsFor(chat.pro.user._id.toHexString())).toEqual([receipt]);
    expect(deps.realtime.eventsFor(chat.customer.user._id.toHexString())).toEqual([receipt]);

    const messages = (await request(app).get(`${chat.path}/messages`).set(chat.pro.headers).expect(200)).body.items as { text: string; readAt: string | null }[];
    // The customer's message was read when the professional replied.
    expect(messages.map((m) => [m.text, m.readAt])).toEqual([
      ['Is parking available?', '2026-10-01T09:03:00.000Z'],
      ['Arriving at 10', '2026-10-01T09:03:00.000Z'],
      ['Hi, when do you come?', '2026-10-01T09:01:00.000Z'],
    ]);
    // A read is not activity: `updatedAt` stays at the last message.
    const conversation = (await request(app).get(chat.path).set(chat.customer.headers).expect(200)).body;
    expect(conversation).toMatchObject({ unreadCount: 0, updatedAt: '2026-10-01T09:01:00.000Z' });
    expect(await NotificationModel.countDocuments({ user: chat.customer.user._id, readAt: null })).toBe(0);
  });

  it('marks the last message read in the conversation list', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.customer, 'Thanks!');
    deps.clock.advanceMinutes(1);
    await request(app).post(`${chat.path}/read`).set(chat.pro.headers).expect(200);
    const list = await request(app).get('/v1/conversations').set(chat.customer.headers).expect(200);
    expect(list.body.items[0].lastMessage).toMatchObject({ text: 'Thanks!', readAt: '2026-10-01T09:01:00.000Z' });
  });

  it('is idempotent: nothing to read → no receipt', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.pro, 'Hello');
    await request(app).post(`${chat.path}/read`).set(chat.customer.headers).expect(200);
    deps.realtime.clear();
    await request(app).post(`${chat.path}/read`).set(chat.customer.headers).expect(200);
    await request(app).post(`${chat.path}/read`).set(chat.pro.headers).expect(200);
    expect(deps.realtime.published).toEqual([]);
    expect(await MessageModel.countDocuments({ readAt: null })).toBe(0);
  });

  it('only affects the caller’s side and requires participation', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.pro, 'Hello');
    const outsider = await signInProfessional(deps);
    await request(app).post(`${chat.path}/read`).set(outsider.headers).expect(403);
    await request(app).post(`/v1/conversations/${newObjectId().toHexString()}/read`).set(chat.customer.headers).expect(404);
    await request(app).post(`${chat.path}/read`).expect(401);
    // The sender reading does not mark their own message read.
    await request(app).post(`${chat.path}/read`).set(chat.pro.headers).expect(200);
    expect(await MessageModel.countDocuments({ readAt: null })).toBe(1);
  });
});
