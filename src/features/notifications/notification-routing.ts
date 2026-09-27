/**
 * Maps notification targets (in-app notifications, push payloads) to app routes. Always resolve
 * deep links through here so every entry point navigates the same way.
 */
import type { Href } from 'expo-router';

import { routes } from '@/lib/routes';
import type { AppNotification, NotificationTarget } from '@/types/domain';

/** Route for a notification target, or `null` when there is nothing to open. */
export function notificationTargetToHref(target: NotificationTarget): Href | null {
  switch (target.kind) {
    case 'request':
      return routes.request(target.requestId);
    case 'offer':
      return routes.offer(target.offerId);
    case 'job':
      return routes.job(target.jobId);
    case 'conversation':
      return routes.conversation(target.conversationId);
    case 'professional':
      return routes.professionalProfile(target.professionalId);
    case 'none':
      return null;
  }
}

/**
 * Route for a notification, refining the target by type where a more specific screen exists
 * (a new review opens the professional's reviews list).
 */
export function getNotificationHref(notification: Pick<AppNotification, 'type' | 'target'>): Href | null {
  if (notification.type === 'review_received' && notification.target.kind === 'professional') {
    return routes.professionalReviews(notification.target.professionalId);
  }
  return notificationTargetToHref(notification.target);
}
