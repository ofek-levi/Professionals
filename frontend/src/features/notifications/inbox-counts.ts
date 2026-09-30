/**
 * Unread counts of the Inbox tab: unread updates (notifications) plus unread chat messages.
 *
 * A chat message also creates a `new_message` notification (one per conversation, collapsed by
 * the server). Those belong to Messages, not Updates: the server leaves them out of the Updates
 * list and its unread count (`excludeTypes=new_message`), so one message never counts twice and
 * the tab badge always equals the sum of the two segment counts, however many notifications the
 * account has.
 */
import { isUpdateNotificationType } from '@/constants/notification-types';
import { useUnreadMessagesCount, useUnreadNotificationsCount } from '@/hooks';
import type { AppNotification } from '@/types/domain';

interface InboxBadgeInput {
  /** Server-side unread notifications under Updates (`new_message` excluded by the server). */
  unreadUpdates: number;
  /** Server-side unread chat messages over all conversations (`GET /conversations/unread-count`). */
  unreadMessages: number;
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
  return isUpdateNotificationType(notification.type);
}

export function countInboxUnread({ unreadUpdates, unreadMessages }: InboxBadgeInput): InboxCounts {
  const updates = Math.max(0, unreadUpdates);
  const messages = Math.max(0, unreadMessages);
  return { updates, messages, total: updates + messages };
}

/**
 * Live unread counts of the Inbox (segments and tab badge), kept fresh by realtime events: both
 * counts come from the server (`message.created` / `conversation.read` refetch the messages one).
 */
export function useInboxCounts(): InboxCounts {
  const unreadUpdates = useUnreadNotificationsCount().data ?? 0;
  const unreadMessages = useUnreadMessagesCount().data ?? 0;
  return countInboxUnread({ unreadUpdates, unreadMessages });
}
