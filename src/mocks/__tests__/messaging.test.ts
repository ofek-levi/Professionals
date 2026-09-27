import type { RealtimeEvent } from '@/services/realtime/types';

import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = DEMO_CUSTOMER_IDS.noa;
const YAEL = PRO_IDS.yael;
const CONVERSATION = SEED_IDS.conversations.noaLighting;

describe('messaging', () => {
  let env: TestEnvironment;
  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('computes last message and unread counts per viewer', async () => {
    const asYael = await env.as(YAEL).conversations.getConversationById(CONVERSATION);
    expect(asYael.unreadCount).toBe(1);
    expect(asYael.lastMessage?.senderId).toBe(NOA);
    const asNoa = await env.as(NOA).conversations.getConversationById(CONVERSATION);
    expect(asNoa.unreadCount).toBe(0);
    expect(asNoa.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: NOA, role: 'customer', displayName: 'Noa Levi' }),
        expect.objectContaining({ userId: YAEL, role: 'professional', displayName: 'BrightSpark Electric' }),
      ]),
    );
    const list = await env.as(NOA).conversations.getConversations();
    expect(list.map((conversation) => conversation.id)).toEqual(
      expect.arrayContaining([SEED_IDS.conversations.noaLighting, SEED_IDS.conversations.noaWardrobe, SEED_IDS.conversations.noaDishwasher]),
    );
    expect(list[0].id).toBe(CONVERSATION); // most recent activity first
  });

  it('sends messages idempotently and pushes realtime events to both participants', async () => {
    const events: Record<string, RealtimeEvent[]> = { [NOA]: [], [YAEL]: [] };
    env.server.events.subscribe(NOA, (event) => events[NOA].push(event));
    env.server.events.subscribe(YAEL, (event) => events[YAEL].push(event));

    const message = await env.as(YAEL).conversations.sendMessage(CONVERSATION, { text: '  On my way!  ', clientMessageId: 'retry-1' });
    expect(message).toMatchObject({ conversationId: CONVERSATION, senderId: YAEL, text: 'On my way!', readAt: null });
    const retry = await env.as(YAEL).conversations.sendMessage(CONVERSATION, { text: 'On my way!', clientMessageId: 'retry-1' });
    expect(retry.id).toBe(message.id);

    expect(events[NOA].filter((event) => event.type === 'message.created')).toHaveLength(1);
    expect(events[YAEL].filter((event) => event.type === 'message.created')).toHaveLength(1);
    expect(events[NOA].some((event) => event.type === 'notification.created' && event.notification.type === 'new_message')).toBe(true);

    // Replying marked Noa's earlier message as read for Yael.
    expect((await env.as(YAEL).conversations.getConversationById(CONVERSATION)).unreadCount).toBe(0);
    expect((await env.as(NOA).conversations.getConversationById(CONVERSATION)).unreadCount).toBe(1);
    await env.as(NOA).conversations.markConversationAsRead(CONVERSATION);
    expect((await env.as(NOA).conversations.getConversationById(CONVERSATION)).unreadCount).toBe(0);
  });

  it('pages messages newest first', async () => {
    const first = await env.as(NOA).conversations.getConversationMessages(CONVERSATION, { limit: 2 });
    expect(first.totalCount).toBe(4);
    expect(first.items.map((message) => message.id)).toEqual(['msg_noa_lighting_4', 'msg_noa_lighting_3']);
    const second = await env.as(NOA).conversations.getConversationMessages(CONVERSATION, { limit: 2, cursor: first.nextCursor });
    expect(second.items.map((message) => message.id)).toEqual(['msg_noa_lighting_2', 'msg_noa_lighting_1']);
    expect(second.nextCursor).toBeNull();
  });

  it('rejects non-participants and invalid messages', async () => {
    expect(await expectApiError(env.as(DEMO_CUSTOMER_IDS.daniel).conversations.getConversationById(CONVERSATION))).toMatchObject({
      status: 403,
    });
    expect(
      await expectApiError(env.as(PRO_IDS.avi).conversations.sendMessage(CONVERSATION, { text: 'Hi', clientMessageId: 'x' })),
    ).toMatchObject({ status: 403 });
    const empty = await expectApiError(env.as(NOA).conversations.sendMessage(CONVERSATION, { text: '   ', clientMessageId: 'x' }));
    expect(empty).toMatchObject({ status: 422 });
    expect(empty.fieldErrors?.text).toEqual(['validation:message.empty']);
  });
});
