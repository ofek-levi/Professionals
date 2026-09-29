/**
 * Unread counts of the Inbox tab: unread updates (notifications) plus unread chat messages.
 *
 * A chat message also creates a `new_message` notification (one per conversation, collapsed by
 * the server). Those belong to Messages, not Updates: the Updates list hides them and the counts
 * leave them out, so one message never counts twice and the tab badge always equals the sum of
 * the two segment counts.
 */
import { useConversations, useNotifications, useUnreadNotificationsCount } from '@/hooks';
import type { AppNotification, Conversation } from '@/types/domain';

interface InboxBadgeInput {
  /** Server-side unread notifications count (all types). */
  unreadNotifications: number;
  /** Loaded unread notifications (to find the `new_message` ones). */
  unreadList: readonly Pick<AppNotification, 'type' | 'readAt'>[];
  conversations: readonly Pick<Conversation, 'unreadCount'>[];
}

interface InboxCounts {
  /** Unread notifications shown under Updates (chat notifications excluded). */
  updates: number;
  /** Unread chat messages across conversations. */
  messages: number;
  /** Tab badge: `updates + messages`. */
  total: number;
}

/** Notifications listed under Updates: everything except chat messages (they live in Messages). */
export function isUpdateNotification(notification: Pick<AppNotification, 'type'>): boolean {
  return notification.type !== 'new_message';
}

export function countInboxUnread({ unreadNotifications, unreadList, conversations }: InboxBadgeInput): InboxCounts {
  const messageNotifications = unreadList.filter((notification) => !isUpdateNotification(notification) && notification.readAt === null).length;
  const updates = Math.max(0, unreadNotifications - messageNotifications);
  const messages = conversations.reduce((sum, conversation) => sum + Math.max(0, conversation.unreadCount), 0);
  return { updates, messages, total: updates + messages };
}

/** Live unread counts of the Inbox (segments and tab badge), kept fresh by realtime events. */
export function useInboxCounts(): InboxCounts {
  const unreadNotifications = useUnreadNotificationsCount().data ?? 0;
  const unreadList = useNotifications({ unreadOnly: true }).data?.items ?? [];
  const conversations = useConversations().data ?? [];
  return countInboxUnread({ unreadNotifications, unreadList, conversations });
}
