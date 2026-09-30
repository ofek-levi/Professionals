import { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import type { PaginatedInfiniteData } from '@/hooks/queries/query-scope';
import type { UnreadCountResponse } from '@/types/api';
import type { AppNotification, Conversation, Message, NotificationPreferences } from '@/types/domain';

import { applyRealtimeEvent, getActiveConversationId, shouldPresentBanner } from '../realtime-events';

const USER = 'user_me';

function page<T>(items: T[]): PaginatedInfiniteData<T> {
  return { pages: [{ items, nextCursor: null, totalCount: items.length }], pageParams: [null] };
}

const notification: AppNotification = {
  id: 'ntf_new',
  userId: USER,
  type: 'offer_received',
  params: {},
  target: { kind: 'offer', offerId: 'off_1', requestId: 'req_1' },
  readAt: null,
  createdAt: '2026-09-27T07:00:00.000Z',
};

const preferences: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: false,
  jobUpdates: true,
  messages: true,
  newRequests: true,
  reminders: true,
};

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
}

/** The cached conversation list (first page). */
function conversationsOf(qc: QueryClient): Conversation[] {
  return qc.getQueryData<PaginatedInfiniteData<Conversation>>(queryKeys.conversations.list(USER))?.pages[0].items ?? [];
}

describe('applyRealtimeEvent', () => {
  it('adds a new notification to cached lists and bumps the unread count', () => {
    const qc = createClient();
    qc.setQueryData(queryKeys.notifications.list(USER, { limit: 20 }), page<AppNotification>([]));
    qc.setQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(USER), { count: 2 });

    applyRealtimeEvent(qc, USER, { type: 'notification.created', notification });

    const list = qc.getQueryData<PaginatedInfiniteData<AppNotification>>(queryKeys.notifications.list(USER, { limit: 20 }));
    expect(list?.pages[0].items.map((item) => item.id)).toEqual(['ntf_new']);
    expect(qc.getQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(USER))).toEqual({ count: 3 });
    expect(qc.getQueryState(queryKeys.notifications.unreadCount(USER))?.isInvalidated).toBe(true);
  });

  it('keeps a chat notification out of the Updates list and its count (it counts under Messages)', () => {
    const qc = createClient();
    const updatesKey = queryKeys.notifications.list(USER, { excludeTypes: ['new_message'], limit: 20 });
    const allKey = queryKeys.notifications.list(USER, { limit: 20 });
    qc.setQueryData(updatesKey, page<AppNotification>([]));
    qc.setQueryData(allKey, page<AppNotification>([]));
    qc.setQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(USER), { count: 2 });

    applyRealtimeEvent(qc, USER, { type: 'notification.created', notification: { ...notification, id: 'ntf_chat', type: 'new_message' } });

    expect(qc.getQueryData<PaginatedInfiniteData<AppNotification>>(updatesKey)?.pages[0].items).toEqual([]);
    expect(qc.getQueryData<PaginatedInfiniteData<AppNotification>>(allKey)?.pages[0].items.map((item) => item.id)).toEqual(['ntf_chat']);
    expect(qc.getQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(USER))).toEqual({ count: 2 });
  });

  it('ignores notifications addressed to another user', () => {
    const qc = createClient();
    qc.setQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(USER), { count: 0 });
    applyRealtimeEvent(qc, USER, { type: 'notification.created', notification: { ...notification, userId: 'someone' } });
    expect(qc.getQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(USER))).toEqual({ count: 0 });
  });

  it('appends incoming messages and updates the conversation list', () => {
    const qc = createClient();
    const message: Message = {
      id: 'msg_2',
      conversationId: 'conv_1',
      senderId: 'other',
      text: 'Hello',
      createdAt: '2026-09-27T08:00:00.000Z',
      readAt: null,
      clientMessageId: null,
    };
    qc.setQueryData(queryKeys.conversations.messages(USER, 'conv_1'), page<Message>([]));
    qc.setQueryData(
      queryKeys.conversations.list(USER),
      page<Conversation>([{ id: 'conv_1', lastMessage: null, unreadCount: 0, updatedAt: '2026-09-27T07:00:00.000Z' } as Conversation]),
    );
    qc.setQueryData<UnreadCountResponse>(queryKeys.conversations.unreadCount(USER), { count: 4 });

    applyRealtimeEvent(qc, USER, { type: 'message.created', message });

    const messages = qc.getQueryData<PaginatedInfiniteData<Message>>(queryKeys.conversations.messages(USER, 'conv_1'));
    expect(messages?.pages[0].items).toEqual([message]);
    const [conversation] = conversationsOf(qc);
    expect(conversation.unreadCount).toBe(1);
    expect(conversation.lastMessage?.id).toBe('msg_2');
    // The inbox badge counts it at once and is refetched (so is the list: its order changed).
    expect(qc.getQueryData<UnreadCountResponse>(queryKeys.conversations.unreadCount(USER))).toEqual({ count: 5 });
    expect(qc.getQueryState(queryKeys.conversations.unreadCount(USER))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(queryKeys.conversations.list(USER))?.isInvalidated).toBe(true);
  });

  describe('conversation.read receipts', () => {
    const mine = (id: string, createdAt: string): Message => ({
      id,
      conversationId: 'conv_1',
      senderId: USER,
      text: id,
      createdAt,
      readAt: null,
      clientMessageId: `c_${id}`,
    });
    const readAt = '2026-09-27T09:00:00.000Z';

    it('marks my messages read when the counterpart reads the chat', () => {
      const qc = createClient();
      const theirs: Message = { ...mine('their', '2026-09-27T07:30:00.000Z'), senderId: 'other', clientMessageId: null };
      qc.setQueryData(
        queryKeys.conversations.messages(USER, 'conv_1'),
        page<Message>([
          mine('optimistic:c_new', '2026-09-27T08:59:00.000Z'),
          mine('after', '2026-09-27T09:05:00.000Z'),
          mine('before', '2026-09-27T08:00:00.000Z'),
          theirs,
        ]),
      );
      qc.setQueryData(queryKeys.conversations.list(USER), page<Conversation>([{ id: 'conv_1', unreadCount: 2 } as Conversation]));

      applyRealtimeEvent(qc, USER, { type: 'conversation.read', conversationId: 'conv_1', readerId: 'other', readAt });

      const items = qc.getQueryData<PaginatedInfiniteData<Message>>(queryKeys.conversations.messages(USER, 'conv_1'))?.pages[0].items ?? [];
      const readById = Object.fromEntries(items.map((item) => [item.id, item.readAt]));
      expect(readById).toEqual({ 'optimistic:c_new': null, after: null, before: readAt, their: null });
      // Someone else reading does not touch my unread badge.
      expect(conversationsOf(qc)[0].unreadCount).toBe(2);
      expect(qc.getQueryState(queryKeys.conversations.list(USER))?.isInvalidated).toBe(true);
    });

    it('clears my unread badge when I read the chat on another device', () => {
      const qc = createClient();
      qc.setQueryData(queryKeys.conversations.list(USER), page<Conversation>([{ id: 'conv_1', unreadCount: 2 } as Conversation]));
      qc.setQueryData<UnreadCountResponse>(queryKeys.conversations.unreadCount(USER), { count: 2 });
      applyRealtimeEvent(qc, USER, { type: 'conversation.read', conversationId: 'conv_1', readerId: USER, readAt });
      expect(conversationsOf(qc)[0].unreadCount).toBe(0);
      expect(qc.getQueryState(queryKeys.conversations.unreadCount(USER))?.isInvalidated).toBe(true);
    });
  });

  it('invalidates the request, offer and job graphs', () => {
    const qc = createClient();
    const requestKey = queryKeys.requests.detail(USER, 'req_1');
    const offerKey = queryKeys.offers.detail(USER, 'off_1');
    const jobKey = queryKeys.jobs.detail(USER, 'job_1');
    const profileKey = queryKeys.professionals.profile(USER, 'pro_1');
    [requestKey, offerKey, jobKey, profileKey].forEach((key) => qc.setQueryData(key, { seeded: true }));

    applyRealtimeEvent(qc, USER, { type: 'request.updated', requestId: 'req_1' });
    expect(qc.getQueryState(requestKey)?.isInvalidated).toBe(true);

    applyRealtimeEvent(qc, USER, { type: 'offer.updated', offerId: 'off_1', requestId: 'req_1' });
    expect(qc.getQueryState(offerKey)?.isInvalidated).toBe(true);

    applyRealtimeEvent(qc, USER, { type: 'job.updated', jobId: 'job_1', requestId: 'req_1' });
    expect(qc.getQueryState(jobKey)?.isInvalidated).toBe(true);

    applyRealtimeEvent(qc, USER, { type: 'profile.updated', professionalId: 'pro_1' });
    expect(qc.getQueryState(profileKey)?.isInvalidated).toBe(true);
  });
});

describe('shouldPresentBanner', () => {
  const context = { preferences, activeConversationId: null };

  it('shows unread notifications by default and when preferences are unknown', () => {
    expect(shouldPresentBanner(notification, context)).toBe(true);
    expect(shouldPresentBanner(notification, { preferences: null, activeConversationId: null })).toBe(true);
  });

  it('respects the banner switch and the per-category preference', () => {
    expect(shouldPresentBanner(notification, { ...context, preferences: { ...preferences, pushEnabled: false } })).toBe(false);
    expect(shouldPresentBanner(notification, { ...context, preferences: { ...preferences, jobUpdates: false } })).toBe(false);
    expect(shouldPresentBanner(notification, { ...context, preferences: { ...preferences, messages: false } })).toBe(true);
  });

  it('skips read notifications and messages of the open conversation', () => {
    expect(shouldPresentBanner({ ...notification, readAt: 'x' }, context)).toBe(false);
    const message = { ...notification, type: 'new_message' as const, target: { kind: 'conversation' as const, conversationId: 'c1' } };
    expect(shouldPresentBanner(message, { ...context, activeConversationId: 'c1' })).toBe(false);
    expect(shouldPresentBanner(message, { ...context, activeConversationId: 'c2' })).toBe(true);
  });
});

describe('getActiveConversationId', () => {
  it('extracts the conversation id from chat paths only', () => {
    expect(getActiveConversationId('/conversations/conv_1')).toBe('conv_1');
    expect(getActiveConversationId('/conversations/a%20b/')).toBe('a b');
    expect(getActiveConversationId('/conversations')).toBeNull();
    expect(getActiveConversationId('/customer/home')).toBeNull();
    expect(getActiveConversationId(undefined)).toBeNull();
  });
});
