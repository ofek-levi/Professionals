/**
 * Notification types. Rendering (title/body) is localized on the client via
 * `notifications:types.<type>.title|body` using the notification's structured `params`.
 */
import type { UserRole } from '@/types/domain/user';
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

export interface NotificationTypeMeta {
  type: NotificationType;
  icon: string;
  tone: StatusTone;
  /** Roles that can receive this notification. */
  audience: readonly UserRole[];
  /** Which preference toggle controls it. */
  preference: 'jobUpdates' | 'messages' | 'newRequests' | 'reminders';
}

export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  new_matching_request: { type: 'new_matching_request', icon: 'map-marker-radius-outline', tone: 'brand', audience: ['professional'], preference: 'newRequests' },
  offer_received: { type: 'offer_received', icon: 'tag-outline', tone: 'brand', audience: ['customer'], preference: 'jobUpdates' },
  offer_updated: { type: 'offer_updated', icon: 'tag-arrow-up-outline', tone: 'info', audience: ['customer'], preference: 'jobUpdates' },
  offer_withdrawn: { type: 'offer_withdrawn', icon: 'undo-variant', tone: 'neutral', audience: ['customer'], preference: 'jobUpdates' },
  offer_accepted: { type: 'offer_accepted', icon: 'check-decagram', tone: 'success', audience: ['professional'], preference: 'jobUpdates' },
  offer_not_selected: { type: 'offer_not_selected', icon: 'close-circle-outline', tone: 'neutral', audience: ['professional'], preference: 'jobUpdates' },
  offer_expired: { type: 'offer_expired', icon: 'clock-alert-outline', tone: 'warning', audience: ['professional'], preference: 'jobUpdates' },
  request_cancelled: { type: 'request_cancelled', icon: 'cancel', tone: 'danger', audience: ['professional'], preference: 'jobUpdates' },
  job_confirmed: { type: 'job_confirmed', icon: 'calendar-check', tone: 'success', audience: ['customer'], preference: 'jobUpdates' },
  job_started: { type: 'job_started', icon: 'progress-wrench', tone: 'warning', audience: ['customer'], preference: 'jobUpdates' },
  appointment_reminder: { type: 'appointment_reminder', icon: 'bell-ring-outline', tone: 'accent', audience: ['customer', 'professional'], preference: 'reminders' },
  job_completed: { type: 'job_completed', icon: 'check-all', tone: 'success', audience: ['customer', 'professional'], preference: 'jobUpdates' },
  review_received: { type: 'review_received', icon: 'star-outline', tone: 'warning', audience: ['professional'], preference: 'jobUpdates' },
  new_message: { type: 'new_message', icon: 'message-text-outline', tone: 'info', audience: ['customer', 'professional'], preference: 'messages' },
};
