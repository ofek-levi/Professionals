/**
 * Pure, immutable cache transformations used by optimistic updates and realtime events.
 * They never mutate their input and return the input unchanged (same reference) when there is
 * nothing to update, so React Query does not notify observers needlessly.
 */
import type { PaginatedInfiniteData } from '@/hooks/queries/query-scope';
import type { RequestDetailsResponse, UnreadCountResponse } from '@/types/api';
import type { AppNotification, Conversation, Message, ServiceRequest } from '@/types/domain';

// ─────────────────────────────── Generic ───────────────────────────────

/** Maps every item of an infinite, cursor-paginated cache entry. */
function mapPaginatedItems<T>(
  data: PaginatedInfiniteData<T> | undefined,
  update: (item: T) => T,
): PaginatedInfiniteData<T> | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((item) => {
      const next = update(item);
      if (next !== item) pageChanged = true;
      return next;
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}

/** Shallow merge that ignores `undefined` values (a PATCH payload never clears with `undefined`). */
export function mergeDefined<T extends object>(target: T, patch: Partial<T>): T {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) as Partial<T>;
  return { ...target, ...defined };
}

// ─────────────────────────────── Notifications ───────────────────────────────

/** Marks one notification as read. */
export function markNotificationRead(
  data: PaginatedInfiniteData<AppNotification> | undefined,
  notificationId: string,
  readAt: string,
): PaginatedInfiniteData<AppNotification> | undefined {
  return mapPaginatedItems(data, (item) => (item.id === notificationId && item.readAt === null ? { ...item, readAt } : item));
}

/** Marks every loaded notification as read. */
export function markAllNotificationsRead(
  data: PaginatedInfiniteData<AppNotification> | undefined,
  readAt: string,
): PaginatedInfiniteData<AppNotification> | undefined {
  return mapPaginatedItems(data, (item) => (item.readAt === null ? { ...item, readAt } : item));
}

/** Whether `notificationId` is loaded and still unread in `data`. */
export function isNotificationUnread(data: PaginatedInfiniteData<AppNotification> | undefined, notificationId: string): boolean {
  return Boolean(data?.pages.some((page) => page.items.some((item) => item.id === notificationId && item.readAt === null)));
}

/**
 * Adds a newly created notification at the top of the first page (no-op when already present or
 * when the list is not cached). `unreadOnly` lists only receive unread notifications.
 */
export function prependNotification(
  data: PaginatedInfiniteData<AppNotification> | undefined,
  notification: AppNotification,
): PaginatedInfiniteData<AppNotification> | undefined {
  if (!data || data.pages.length === 0) return data;
  if (data.pages.some((page) => page.items.some((item) => item.id === notification.id))) return data;
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [{ ...first, items: [notification, ...first.items], totalCount: first.totalCount + 1 }, ...rest],
  };
}

/** Adjusts the cached unread count by `delta`, never below zero. */
export function adjustUnreadCount(data: UnreadCountResponse | undefined, delta: number): UnreadCountResponse | undefined {
  if (!data) return data;
  return { count: Math.max(0, data.count + delta) };
}

// ─────────────────────────────── Messages ───────────────────────────────

const OPTIMISTIC_MESSAGE_PREFIX = 'optimistic:';

/** `true` for a message that is still being sent (optimistic, not yet confirmed by the server). */
export function isPendingMessage(message: Pick<Message, 'id'>): boolean {
  return message.id.startsWith(OPTIMISTIC_MESSAGE_PREFIX);
}

export function createOptimisticMessage(input: {
  conversationId: string;
  senderId: string;
  text: string;
  clientMessageId: string;
  now?: Date;
}): Message {
  return {
    id: `${OPTIMISTIC_MESSAGE_PREFIX}${input.clientMessageId}`,
    conversationId: input.conversationId,
    senderId: input.senderId,
    text: input.text,
    createdAt: (input.now ?? new Date()).toISOString(),
    readAt: null,
    clientMessageId: input.clientMessageId,
  };
}

function isSameMessage(a: Message, b: Message): boolean {
  return a.id === b.id || (a.clientMessageId !== null && a.clientMessageId === b.clientMessageId);
}

/**
 * Inserts or reconciles a message in a newest-first message cache:
 * - an existing entry with the same id or `clientMessageId` (e.g. the optimistic copy) is replaced
 *   in place;
 * - otherwise the message is added at the top of the first page.
 * Returns `data` unchanged when the list is not cached.
 */
export function upsertMessage(
  data: PaginatedInfiniteData<Message> | undefined,
  message: Message,
): PaginatedInfiniteData<Message> | undefined {
  if (!data || data.pages.length === 0) return data;
  let found = false;
  const pages = data.pages.map((page) => {
    const index = page.items.findIndex((item) => isSameMessage(item, message));
    if (index === -1 || found) {
      // Drop later duplicates (a message can only appear once).
      if (index !== -1) return { ...page, items: page.items.filter((item) => !isSameMessage(item, message)) };
      return page;
    }
    found = true;
    const items = [...page.items];
    items[index] = message;
    return { ...page, items };
  });
  if (found) return { ...data, pages };
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [{ ...first, items: [message, ...first.items], totalCount: first.totalCount + 1 }, ...rest],
  };
}

/** Removes the message with `clientMessageId` (rollback of a failed optimistic send). */
export function removeMessageByClientId(
  data: PaginatedInfiniteData<Message> | undefined,
  clientMessageId: string,
): PaginatedInfiniteData<Message> | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = page.items.filter((item) => item.clientMessageId !== clientMessageId);
    if (items.length === page.items.length) return page;
    changed = true;
    return { ...page, items, totalCount: Math.max(0, page.totalCount - (page.items.length - items.length)) };
  });
  return changed ? { ...data, pages } : data;
}

/** Applies a new message to a conversation summary (last message, unread count). */
export function applyMessageToConversation(conversation: Conversation, message: Message, viewerId: string | null): Conversation {
  if (conversation.id !== message.conversationId) return conversation;
  const isIncoming = message.senderId !== viewerId;
  const isNewer = !conversation.lastMessage || Date.parse(message.createdAt) >= Date.parse(conversation.lastMessage.createdAt);
  return {
    ...conversation,
    lastMessage: isNewer ? message : conversation.lastMessage,
    unreadCount: isIncoming && isNewer ? conversation.unreadCount + 1 : conversation.unreadCount,
    updatedAt: isNewer ? message.createdAt : conversation.updatedAt,
  };
}

/**
 * Read receipt: marks the messages `readerId` received up to `readAt` as read (messages sent by the
 * other participant, not yet read, created no later than `readAt`; pending optimistic copies are
 * left alone). Returns `data` unchanged when nothing changes.
 */
export function markMessagesReadBy(
  data: PaginatedInfiniteData<Message> | undefined,
  readerId: string,
  readAt: string,
): PaginatedInfiniteData<Message> | undefined {
  const readTime = Date.parse(readAt);
  return mapPaginatedItems(data, (message) =>
    message.senderId !== readerId && message.readAt === null && !isPendingMessage(message) && Date.parse(message.createdAt) <= readTime
      ? { ...message, readAt }
      : message,
  );
}

/** Clears the unread counter of a conversation. */
export function markConversationRead(conversation: Conversation): Conversation {
  return conversation.unreadCount === 0 ? conversation : { ...conversation, unreadCount: 0 };
}

// ─────────────────────────────── Requests ───────────────────────────────

/**
 * Merges a server `ServiceRequest` (e.g. from `AcceptOfferResponse`) into a cached request detail,
 * keeping the view-specific fields (`latestOfferAt`, `myOffer`, …).
 */
export function mergeRequestIntoDetail(
  detail: RequestDetailsResponse | undefined,
  request: ServiceRequest,
): RequestDetailsResponse | undefined {
  if (!detail || detail.request.id !== request.id) return detail;
  return detail.viewerRole === 'customer'
    ? { viewerRole: 'customer', request: { ...detail.request, ...request } }
    : { viewerRole: 'professional', request: { ...detail.request, ...request } };
}
