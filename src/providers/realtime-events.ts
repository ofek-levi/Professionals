/**
 * How realtime (server push) events update the React Query cache, plus the policy deciding
 * whether a new notification is presented as an in-app banner. Pure functions of their inputs –
 * the `RealtimeProvider` wires them to the realtime client.
 */
import type { QueryClient } from '@tanstack/react-query';

import { NOTIFICATION_TYPE_META } from '@/constants/notification-types';
import {
  adjustUnreadCount,
  applyMessageToConversation,
  prependNotification,
  upsertMessage,
} from '@/hooks/mutations/cache-updates';
import {
  invalidateConversation,
  invalidateJobGraph,
  invalidateNotifications,
  invalidateOfferGraph,
  invalidateOwnProfile,
  invalidateProfessional,
  invalidateRequestGraph,
} from '@/hooks/mutations/invalidation';
import { queryKeys } from '@/hooks/queries/query-keys';
import type { PaginatedInfiniteData } from '@/hooks/queries/query-scope';
import type { RealtimeEvent } from '@/services/realtime/types';
import type { UnreadCountResponse } from '@/types/api';
import type { AppNotification, Conversation, Message, NotificationPreferences } from '@/types/domain';

type CacheClient = Pick<QueryClient, 'invalidateQueries' | 'setQueryData' | 'setQueriesData'>;

/** Applies one realtime event for the signed-in `userId`. */
export function applyRealtimeEvent(qc: CacheClient, userId: string, event: RealtimeEvent): void {
  switch (event.type) {
    case 'notification.created': {
      const { notification } = event;
      if (notification.userId !== userId) return;
      qc.setQueriesData<PaginatedInfiniteData<AppNotification>>({ queryKey: queryKeys.notifications.lists(userId) }, (data) =>
        prependNotification(data, notification),
      );
      if (notification.readAt === null) {
        qc.setQueryData<UnreadCountResponse>(queryKeys.notifications.unreadCount(userId), (data) => adjustUnreadCount(data, 1));
      }
      void invalidateNotifications(qc, userId);
      return;
    }
    case 'message.created': {
      const { message } = event;
      qc.setQueryData<PaginatedInfiniteData<Message>>(queryKeys.conversations.messages(userId, message.conversationId), (data) =>
        upsertMessage(data, message),
      );
      qc.setQueryData<Conversation[]>(queryKeys.conversations.list(userId), (list) =>
        list?.map((conversation) => applyMessageToConversation(conversation, message, userId)),
      );
      void invalidateConversation(qc, userId, message.conversationId);
      return;
    }
    case 'request.updated':
      void invalidateRequestGraph(qc, userId, event.requestId);
      return;
    case 'offer.updated':
      void invalidateOfferGraph(qc, userId, { offerId: event.offerId, requestId: event.requestId });
      return;
    case 'job.updated':
      void invalidateJobGraph(qc, userId, { jobId: event.jobId, requestId: event.requestId });
      return;
    case 'profile.updated':
      void invalidateProfessional(qc, userId, event.professionalId);
      void invalidateOwnProfile(qc, userId);
      return;
  }
}

export interface BannerContext {
  /** The recipient's preferences, when loaded (`null` = unknown → show). */
  preferences: NotificationPreferences | null;
  /** Conversation currently open on screen (its messages are visible already). */
  activeConversationId: string | null;
}

/** Whether a new notification should pop up as an in-app banner. */
export function shouldPresentBanner(notification: Pick<AppNotification, 'type' | 'target' | 'readAt'>, context: BannerContext): boolean {
  if (notification.readAt !== null) return false;
  const { preferences } = context;
  if (preferences && (!preferences.pushEnabled || !preferences[NOTIFICATION_TYPE_META[notification.type].preference])) {
    return false;
  }
  if (
    notification.target.kind === 'conversation' &&
    context.activeConversationId !== null &&
    notification.target.conversationId === context.activeConversationId
  ) {
    return false;
  }
  return true;
}

/** Extracts the conversation id from a pathname like `/conversations/abc`. */
export function getActiveConversationId(pathname: string | null | undefined): string | null {
  const match = /^\/conversations\/([^/?#]+)\/?$/.exec(pathname ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}
