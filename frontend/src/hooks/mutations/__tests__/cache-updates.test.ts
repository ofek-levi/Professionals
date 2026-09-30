import type { PaginatedInfiniteData } from '@/hooks/queries/query-scope';
import type { CustomerRequestView, Message, AppNotification, Conversation, ServiceRequest } from '@/types/domain';

import {
  adjustUnreadCount,
  applyMessageToConversation,
  createOptimisticMessage,
  isPendingMessage,
  isUnreadUpdate,
  markAllNotificationsRead,
  markNotificationRead,
  mergeDefined,
  mergeRequestIntoDetail,
  notificationListShows,
  prependNotification,
  removeMessageByClientId,
  upsertMessage,
} from '../cache-updates';

function pages<T>(...pageItems: T[][]): PaginatedInfiniteData<T> {
  return {
    pages: pageItems.map((items, index) => ({ items, nextCursor: index < pageItems.length - 1 ? `c${index + 1}` : null, totalCount: 99 })),
    pageParams: pageItems.map((_, index) => (index === 0 ? null : `c${index}`)),
  };
}

function notification(id: string, readAt: string | null = null): AppNotification {
  return {
    id,
    userId: 'u1',
    type: 'offer_received',
    params: {},
    target: { kind: 'offer', offerId: 'o1', requestId: 'r1' },
    readAt,
    createdAt: '2026-09-27T07:00:00.000Z',
  };
}

function message(id: string, clientMessageId: string | null, createdAt = '2026-09-27T07:00:00.000Z'): Message {
  return { id, conversationId: 'c1', senderId: 'u1', text: `text ${id}`, createdAt, readAt: null, clientMessageId };
}

describe('notification cache updates', () => {
  it('marks a single notification read without touching others', () => {
    const data = pages([notification('n1'), notification('n2')], [notification('n3')]);
    const next = markNotificationRead(data, 'n3', 'now');
    expect(next?.pages[1].items[0].readAt).toBe('now');
    expect(next?.pages[0]).toBe(data.pages[0]);
    expect(isUnreadUpdate(next, 'n3')).toBe(false);
    expect(isUnreadUpdate(next, 'n1')).toBe(true);
  });

  it('counts only unread updates (a chat notification counts under Messages)', () => {
    const data = pages<AppNotification>([notification('n1'), { ...notification('chat'), type: 'new_message' }]);
    expect(isUnreadUpdate(data, 'n1')).toBe(true);
    expect(isUnreadUpdate(data, 'chat')).toBe(false);
    expect(isUnreadUpdate(data, 'missing')).toBe(false);
  });

  it('knows which cached lists show a notification (their filters)', () => {
    const update = notification('n1');
    const chat = { ...notification('c1'), type: 'new_message' as const };
    const key = (params: object) => ['u', 'u1', 'notifications', 'list', params];
    expect(notificationListShows(key({ excludeTypes: ['new_message'] }), update)).toBe(true);
    expect(notificationListShows(key({ excludeTypes: ['new_message'] }), chat)).toBe(false);
    expect(notificationListShows(key({ unreadOnly: true }), { ...update, readAt: 'x' })).toBe(false);
    expect(notificationListShows(['u', 'u1', 'notifications', 'list'], chat)).toBe(true);
  });

  it('returns the same reference when nothing changes', () => {
    const data = pages([notification('n1', 'earlier')]);
    expect(markNotificationRead(data, 'n1', 'now')).toBe(data);
    expect(markNotificationRead(undefined, 'n1', 'now')).toBeUndefined();
  });

  it('marks everything read', () => {
    const next = markAllNotificationsRead(pages([notification('n1'), notification('n2', 'x')]), 'now');
    expect(next?.pages[0].items.map((item) => item.readAt)).toEqual(['now', 'x']);
  });

  it('prepends new notifications once', () => {
    const data = pages([notification('n1')]);
    const next = prependNotification(data, notification('n0'));
    expect(next?.pages[0].items.map((item) => item.id)).toEqual(['n0', 'n1']);
    expect(next?.pages[0].totalCount).toBe(100);
    expect(prependNotification(next, notification('n0'))).toBe(next);
  });

  it('adjusts the unread count without going negative', () => {
    expect(adjustUnreadCount({ count: 2 }, 1)).toEqual({ count: 3 });
    expect(adjustUnreadCount({ count: 0 }, -1)).toEqual({ count: 0 });
    expect(adjustUnreadCount(undefined, 1)).toBeUndefined();
  });
});

describe('message cache updates', () => {
  it('appends an optimistic message and reconciles it with the server copy', () => {
    const data = pages([message('m2', null), message('m1', null)]);
    const optimistic = createOptimisticMessage({ conversationId: 'c1', senderId: 'u1', text: 'Hi', clientMessageId: 'cm1' });
    expect(isPendingMessage(optimistic)).toBe(true);

    const withOptimistic = upsertMessage(data, optimistic);
    expect(withOptimistic?.pages[0].items[0]).toBe(optimistic);

    const server = message('m3', 'cm1');
    const reconciled = upsertMessage(withOptimistic, server);
    expect(reconciled?.pages[0].items.map((item) => item.id)).toEqual(['m3', 'm2', 'm1']);
    expect(isPendingMessage(reconciled!.pages[0].items[0])).toBe(false);

    // The realtime echo of the same message must not create a duplicate.
    const echoed = upsertMessage(reconciled, server);
    expect(echoed?.pages[0].items.map((item) => item.id)).toEqual(['m3', 'm2', 'm1']);
  });

  it('removes a failed optimistic message by client id', () => {
    const optimistic = createOptimisticMessage({ conversationId: 'c1', senderId: 'u1', text: 'Hi', clientMessageId: 'cm1' });
    const data = pages([optimistic, message('m1', null)]);
    const next = removeMessageByClientId(data, 'cm1');
    expect(next?.pages[0].items.map((item) => item.id)).toEqual(['m1']);
    expect(removeMessageByClientId(next, 'cm1')).toBe(next);
  });

  it('does not create a cache entry for conversations that are not loaded', () => {
    expect(upsertMessage(undefined, message('m1', null))).toBeUndefined();
  });

  it('updates conversation summaries for incoming and own messages', () => {
    const conversation = {
      id: 'c1',
      lastMessage: message('m1', null, '2026-09-27T06:00:00.000Z'),
      unreadCount: 0,
      updatedAt: '2026-09-27T06:00:00.000Z',
    } as Conversation;
    const incoming = { ...message('m2', null), senderId: 'someone-else' };
    const afterIncoming = applyMessageToConversation(conversation, incoming, 'u1');
    expect(afterIncoming.lastMessage?.id).toBe('m2');
    expect(afterIncoming.unreadCount).toBe(1);

    const own = applyMessageToConversation(conversation, message('m3', null), 'u1');
    expect(own.unreadCount).toBe(0);
  });
});

describe('request and patch helpers', () => {
  it('merges an accepted request into the customer detail keeping view fields', () => {
    const view = { id: 'r1', status: 'offers_received', latestOfferAt: 'x', lowestOfferPrice: 300 } as CustomerRequestView;
    const updated = { id: 'r1', status: 'professional_selected', acceptedOfferId: 'o1' } as ServiceRequest;
    const merged = mergeRequestIntoDetail({ viewerRole: 'customer', request: view }, updated);
    expect(merged).toEqual({
      viewerRole: 'customer',
      request: { ...view, status: 'professional_selected', acceptedOfferId: 'o1' },
    });
    expect(mergeRequestIntoDetail(undefined, updated)).toBeUndefined();
  });

  it('ignores undefined values in patches', () => {
    expect(mergeDefined({ a: 1, b: 2 }, { a: undefined, b: 3 })).toEqual({ a: 1, b: 3 });
  });
});
