/** Notification types (copied from the app's `frontend/src/constants/notification-types.ts`). */
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

/** The `NotificationPreferences` toggle that controls each type. */
export type NotificationCategoryPreference = 'jobUpdates' | 'messages' | 'newRequests' | 'reminders';

export const NOTIFICATION_TYPE_PREFERENCE: Record<NotificationType, NotificationCategoryPreference> = {
  new_matching_request: 'newRequests',
  offer_received: 'jobUpdates',
  offer_updated: 'jobUpdates',
  offer_withdrawn: 'jobUpdates',
  offer_accepted: 'jobUpdates',
  offer_not_selected: 'jobUpdates',
  offer_expired: 'jobUpdates',
  request_cancelled: 'jobUpdates',
  job_confirmed: 'jobUpdates',
  job_started: 'jobUpdates',
  appointment_reminder: 'reminders',
  job_completed: 'jobUpdates',
  job_cancelled: 'jobUpdates',
  review_received: 'jobUpdates',
  new_message: 'messages',
};
