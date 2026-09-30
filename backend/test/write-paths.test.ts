/**
 * The chat write path, measured with MongoDB's profiler: a message or a read touches only what it
 * changes, however many unread notifications of other kinds the user has collected.
 */
import type { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createChat, send } from '../src/modules/conversations/__tests__/chat-fixture.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { clearDatabase, createTestApp } from './app.js';
import { on, profiled } from './query-profile.js';

describe('chat write path', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  /** Professionals collect one unread `new_matching_request` per matching request published. */
  async function unreadBacklog(user: Types.ObjectId, count: number): Promise<void> {
    await NotificationModel.collection.insertMany(
      Array.from({ length: count }, () => ({ user, type: 'new_matching_request', params: {}, target: { kind: 'none' }, readAt: null, createdAt: new Date() })),
    );
  }

  it('reading a chat and collapsing its message notification touch one notification, not the backlog', async () => {
    const chat = await createChat(deps);
    await unreadBacklog(chat.pro.user._id, 300);
    await send(app, chat, chat.customer, 'first');

    // The customer writes again: the pro's unread chat notification is replaced by the new one.
    const collapse = await profiled(() => send(app, chat, chat.customer, 'second'));
    const removals = on(collapse, 'notifications', 'remove');
    expect(removals).toHaveLength(1);
    expect(removals[0]?.keysExamined).toBeLessThanOrEqual(2);

    const read = await profiled(() => request(app).post(`${chat.path}/read`).set(chat.pro.headers).expect(200));
    const updates = on(read, 'notifications', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.keysExamined).toBeLessThanOrEqual(2);
    expect(await NotificationModel.countDocuments({ user: chat.pro.user._id, type: 'new_message', readAt: null })).toBe(0);
  });

  it('a message into a chat with nothing unread skips the read receipt, the collapse and any job lookup', async () => {
    const chat = await createChat(deps);
    const ops = await profiled(() => send(app, chat, chat.customer, 'hello'));
    expect(on(ops, 'jobs')).toEqual([]);
    expect(on(ops, 'messages', 'update')).toEqual([]);
    expect(on(ops, 'notifications').map((op) => op.op)).toEqual(['insert']);
    // One read before the transaction, one conditional write inside it.
    expect(on(ops, 'conversations').map((op) => op.op)).toEqual(['query', 'command']);
    // Before: conversation, sent-message lookup and sender name (in parallel); inside the
    // transaction: insert, conversation update, recipient preferences, notification insert. (The
    // push fan-out reads the recipient's `sessions` in the background, after the response.)
    const onRequestPath = ops.filter((op) => !op.ns.endsWith('.sessions'));
    expect(onRequestPath).toHaveLength(7);

    // The reply reads the customer's message: now the receipt runs (and only then).
    const reply = await profiled(() => send(app, chat, chat.pro, 'hi'));
    expect(on(reply, 'messages', 'update')).toHaveLength(1);
  });
});
