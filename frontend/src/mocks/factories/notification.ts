import { buildNotification, type NotificationInput } from '@/features/notifications/notification-factory';
import type { AppNotification, ISODateTimeString } from '@/types/domain';

interface NotificationFactoryInput {
  id: string;
  userId: string;
  createdAt: ISODateTimeString;
  readAt?: ISODateTimeString | null;
  input: NotificationInput;
}

/** Builds a notification exactly like the backend's notification service would. */
export function createNotification({ id, userId, createdAt, readAt = null, input }: NotificationFactoryInput): AppNotification {
  return buildNotification(input, { id, userId, now: createdAt, readAt });
}
