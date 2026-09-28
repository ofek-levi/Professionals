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
  'review_received',
  'new_message',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

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
  review_received: { icon: 'star-outline', tone: 'warning', preference: 'jobUpdates' },
  new_message: { icon: 'message-text-outline', tone: 'info', preference: 'messages' },
};
