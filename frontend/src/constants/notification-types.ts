/**
 * Notification types. Rendering (title/body) is localized on the client via
 * `notifications:types.<type>.title|body` using the notification's structured `params`.
 */
import type { StatusTone } from './tones';

export const NOTIFICATION_TYPES = [
  'new_matching_request',
  'offer_received',
  'offer_updated',
  'offer_withdrawn',
  'offer_accepted',
  'offer_not_selected',
  'offer_expired',
  'request_cancelled',
  'job_confirmed',
  'job_started',
  'appointment_reminder',
  'job_completed',
  /** To the customer when the hired professional deleted their account (the job is cancelled). */
  'job_cancelled',
  'review_received',
  'new_message',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Chat notifications: a message also creates one (per conversation, collapsed by the server). The
 * Inbox shows them under Messages, so the Updates list and its count ask the server to leave them
 * out (`excludeTypes`).
 */
export const CHAT_NOTIFICATION_TYPES = ['new_message'] as const satisfies readonly NotificationType[];

/** Notifications listed under Updates: everything except chat messages. */
export function isUpdateNotificationType(type: NotificationType): boolean {
  return !(CHAT_NOTIFICATION_TYPES as readonly NotificationType[]).includes(type);
}

interface NotificationTypeMeta {
  icon: string;
  tone: StatusTone;
  /** Which preference toggle controls it. */
  preference: 'jobUpdates' | 'messages' | 'newRequests' | 'reminders';
}

export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  new_matching_request: { icon: 'map-marker-radius-outline', tone: 'brand', preference: 'newRequests' },
  offer_received: { icon: 'tag-outline', tone: 'brand', preference: 'jobUpdates' },
  offer_updated: { icon: 'tag-arrow-up-outline', tone: 'info', preference: 'jobUpdates' },
  offer_withdrawn: { icon: 'undo-variant', tone: 'neutral', preference: 'jobUpdates' },
  offer_accepted: { icon: 'check-decagram', tone: 'success', preference: 'jobUpdates' },
  offer_not_selected: { icon: 'close-circle-outline', tone: 'neutral', preference: 'jobUpdates' },
  offer_expired: { icon: 'clock-alert-outline', tone: 'warning', preference: 'jobUpdates' },
  request_cancelled: { icon: 'cancel', tone: 'danger', preference: 'jobUpdates' },
  job_confirmed: { icon: 'calendar-check', tone: 'success', preference: 'jobUpdates' },
  job_started: { icon: 'progress-wrench', tone: 'warning', preference: 'jobUpdates' },
  appointment_reminder: { icon: 'bell-ring-outline', tone: 'accent', preference: 'reminders' },
  job_completed: { icon: 'check-all', tone: 'success', preference: 'jobUpdates' },
  job_cancelled: { icon: 'calendar-remove', tone: 'danger', preference: 'jobUpdates' },
  review_received: { icon: 'star-outline', tone: 'warning', preference: 'jobUpdates' },
  new_message: { icon: 'message-text-outline', tone: 'info', preference: 'messages' },
};

/**
 * Display rules of `type`, or `null` for a type this app version does not know (a newer server may
 * add types; installed apps cannot be forced to update). Callers render such items generically.
 */
export function notificationTypeMeta(type: NotificationType): NotificationTypeMeta | null {
  return (NOTIFICATION_TYPE_META as Partial<Record<string, NotificationTypeMeta>>)[type] ?? null;
}
