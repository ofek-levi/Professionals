import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer } from '../../../../test/auth.js';
import { createPushSession } from '../../../../test/factories.js';
import { NotificationModel } from '../../notifications/notification.model.js';
import { UserModel } from '../../users/user.model.js';
import { closeConversation } from '../conversation-lifecycle.service.js';
import { ConversationModel } from '../conversation.model.js';
import { MessageModel } from '../message.model.js';
import { createChat, send } from './chat-fixture.js';

// One app per file: the model clock (createdAt/updatedAt) is process-wide.
const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
beforeEach(async () => {
  await clearDatabase();
  deps.clock.set('2026-10-01T09:00:00.000Z');
  deps.realtime.clear();
  deps.push.sent.length = 0;
});

describe('POST /v1/conversations/:id/messages', () => {
  it('stores the message, notifies the recipient and publishes it to both participants', async () => {
    const chat = await createChat(deps);
    const phone = await createPushSession(chat.customer.user);
    const customerId = chat.customer.user._id.toHexString();
    const proId = chat.pro.user._id.toHexString();

    const res = await request(app)
      .post(`${chat.path}/messages`)
      .set(chat.pro.headers)
      .send({ text: '  I can come at 10:00.\r\n\n\n\nBring the key?  ', clientMessageId: 'c-1' })
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      conversationId: chat.conversationId,
      senderId: proId,
      text: 'I can come at 10:00.\n\nBring the key?',
      createdAt: '2026-10-01T09:00:00.000Z',
      readAt: null,
      clientMessageId: 'c-1',
    });

    const [notification] = await NotificationModel.find({ user: chat.customer.user._id }).lean();
    expect(notification).toMatchObject({
      type: 'new_message',
      params: { categoryId: 'plumbing', professionalName: 'Avi Fix', messagePreview: 'I can come at 10:00. Bring the key?' },
      target: { kind: 'conversation', conversationId: chat.conversationId },
      readAt: null,
    });
    expect(deps.realtime.eventsFor(proId)).toEqual([{ type: 'message.created', message: res.body }]);
    expect(deps.realtime.eventsFor(customerId)).toEqual([
      { type: 'notification.created', notification: expect.objectContaining({ type: 'new_message' }) },
      { type: 'message.created', message: res.body },
    ]);

    await deps.background.drain();
    expect(deps.push.sent).toEqual([
      {
        to: phone.pushToken,
        title: 'New message from ⁨Avi Fix⁩',
        body: 'I can come at 10:00. Bring the key?',
        data: { notificationId: notification?._id.toHexString(), notificationType: 'new_message', target: notification?.target },
      },
    ]);
    const conversation = await ConversationModel.findById(chat.conversationId).lean();
    expect(conversation?.participants.map((p) => p.unreadCount)).toEqual([1, 0]);
  });

  it('names the customer by full name to the professional', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.customer, 'Hello!');
    const [notification] = await NotificationModel.find({ user: chat.pro.user._id }).lean();
    expect(notification?.params).toEqual({ categoryId: 'plumbing', customerName: 'Noa Levi', messagePreview: 'Hello!' });
  });

  it('is idempotent per clientMessageId, without repeating side effects', async () => {
    const chat = await createChat(deps);
    const first = await send(app, chat, chat.pro, 'On my way', 'retry-1');
    deps.realtime.clear();
    deps.clock.advanceMinutes(1);
    const again = await send(app, chat, chat.pro, 'On my way (edited)', 'retry-1');
    expect(again).toEqual(first);
    expect(deps.realtime.published).toEqual([]);
    expect(await MessageModel.countDocuments()).toBe(1);
    expect(await NotificationModel.countDocuments()).toBe(1);
    expect((await ConversationModel.findById(chat.conversationId).lean())?.participants[0]?.unreadCount).toBe(1);

    // The same client id from the other participant is a different message.
    await send(app, chat, chat.customer, 'Great', 'retry-1');
    expect(await MessageModel.countDocuments()).toBe(2);
  });

  it('stores one message when identical retries race', async () => {
    const chat = await createChat(deps);
    const post = () => request(app).post(`${chat.path}/messages`).set(chat.customer.headers).send({ text: 'Twice?', clientMessageId: 'race' });
    const responses = await Promise.all([post(), post(), post()]);
    expect(responses.map((res) => res.status)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((res) => (res.body as { id: string }).id)).size).toBe(1);
    expect(await MessageModel.countDocuments()).toBe(1);
    expect((await ConversationModel.findById(chat.conversationId).lean())?.participants[1]?.unreadCount).toBe(1);
  });

  it('replying reads the counterpart’s messages and sends a read receipt', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.customer, 'Are you coming?');
    await send(app, chat, chat.customer, 'Hello?');
    deps.clock.advanceMinutes(5);
    deps.realtime.clear();

    await send(app, chat, chat.pro, 'Yes, 10 minutes');
    const readAt = '2026-10-01T09:05:00.000Z';
    const receipt = { type: 'conversation.read', conversationId: chat.conversationId, readerId: chat.pro.user._id.toHexString(), readAt };
    expect(deps.realtime.eventsFor(chat.customer.user._id.toHexString())[0]).toEqual(receipt);
    expect(await MessageModel.countDocuments({ sender: chat.customer.user._id, readAt: new Date(readAt) })).toBe(2);
    expect(await NotificationModel.countDocuments({ user: chat.pro.user._id, readAt: null })).toBe(0);
    const conversation = await ConversationModel.findById(chat.conversationId).lean();
    expect(conversation?.participants.map((p) => p.unreadCount)).toEqual([1, 0]);
  });

  it('keeps a single unread chat notification per conversation', async () => {
    const chat = await createChat(deps);
    await send(app, chat, chat.pro, 'First');
    await send(app, chat, chat.pro, 'Second');
    const notifications = await NotificationModel.find({ user: chat.customer.user._id }).lean();
    expect(notifications.map((n) => n.params.messagePreview)).toEqual(['Second']);
  });

  it('skips the notification when the recipient turned chat notifications off', async () => {
    const chat = await createChat(deps);
    await UserModel.updateOne({ _id: chat.customer.user._id }, { $set: { 'notificationPreferences.messages': false } });
    await send(app, chat, chat.pro, 'Quiet please');
    expect(await NotificationModel.countDocuments()).toBe(0);
    expect(deps.realtime.eventsFor(chat.customer.user._id.toHexString()).map((e) => e.type)).toEqual(['message.created']);
  });

  it('refuses new messages once the conversation is closed, but still answers retries', async () => {
    const chat = await createChat(deps);
    const sent = await send(app, chat, chat.customer, 'Before the cancel', 'kept');
    await closeConversation(chat.job.conversation);

    const res = await request(app).post(`${chat.path}/messages`).set(chat.customer.headers).send({ text: 'After', clientMessageId: 'new' }).expect(409);
    expect(res.body).toEqual({ code: 'CONFLICT', message: 'This conversation is closed' });
    expect(await send(app, chat, chat.customer, 'Before the cancel', 'kept')).toEqual(sent);
    expect((await request(app).get(chat.path).set(chat.customer.headers).expect(200)).body.isOpen).toBe(false);
  });

  it('validates the payload like the app', async () => {
    const chat = await createChat(deps);
    const post = (body: object) => request(app).post(`${chat.path}/messages`).set(chat.pro.headers).send(body);

    const empty = await post({ text: ' \n\n ', clientMessageId: '' }).expect(400);
    expect(empty.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
      fieldErrors: { text: ['validation:message.empty'], clientMessageId: ['validation:invalid'] },
    });
    const missing = await post({}).expect(400);
    expect(missing.body.fieldErrors).toEqual({ text: ['validation:message.empty'], clientMessageId: ['validation:invalid'] });
    const tooLong = await post({ text: 'x'.repeat(2001), clientMessageId: 'long' }).expect(400);
    expect(tooLong.body.fieldErrors).toEqual({ text: ['validation:message.tooLong'] });
    await post({ text: 'x'.repeat(2000), clientMessageId: 'max' }).expect(201);
    // Trailing spaces are trimmed, so a raw text a bit over the limit is still accepted.
    await post({ text: `${'y'.repeat(2000)}${' '.repeat(500)}`, clientMessageId: 'spaces' }).expect(201);
  });

  it('rejects a huge text quickly, before normalizing it', async () => {
    const chat = await createChat(deps);
    const started = performance.now();
    const res = await request(app)
      .post(`${chat.path}/messages`)
      .set(chat.pro.headers)
      .send({ text: `a${' '.repeat(90_000)}a`, clientMessageId: 'huge' })
      .expect(400);
    expect(res.body.fieldErrors).toEqual({ text: ['validation:message.tooLong'] });
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('only lets participants send', async () => {
    const chat = await createChat(deps);
    const outsider = await signInCustomer(deps);
    await request(app).post(`${chat.path}/messages`).set(outsider.headers).send({ text: 'Hi', clientMessageId: 'x' }).expect(403);
    await request(app).post('/v1/conversations/nope/messages').set(chat.customer.headers).send({ text: 'Hi', clientMessageId: 'x' }).expect(404);
    await request(app).post(`${chat.path}/messages`).send({ text: 'Hi', clientMessageId: 'x' }).expect(401);
    expect(await MessageModel.countDocuments()).toBe(0);
  });
});
