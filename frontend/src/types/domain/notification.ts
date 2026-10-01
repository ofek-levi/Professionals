import type { EntityId, ISODateTimeString } from './common';
import type { CategoryId } from './category';
import type { NotificationType } from '@/constants/notification-types';

export type { NotificationType };

/** Where tapping a notification should navigate to. */
export type NotificationTarget =
  | { kind: 'request'; requestId: EntityId }
  | { kind: 'offer'; offerId: EntityId; requestId: EntityId }
  | { kind: 'job'; jobId: EntityId }
  | { kind: 'conversation'; conversationId: EntityId }
  | { kind: 'professional'; professionalId: EntityId }
  | { kind: 'none' };

/**
 * Structured parameters used to render the notification text on the client
 * (so it can be localized). All fields optional; each type documents what it provides.
 */
export interface NotificationParams {
  categoryId?: CategoryId;
  professionalName?: string;
  customerName?: string;
  price?: number;
  currency?: string;
  scheduledAt?: ISODateTimeString;
  rating?: number;
  messagePreview?: string;
  distanceKm?: number;
  reason?: 'account_deleted';
}

export interface AppNotification {
  id: EntityId;
  userId: EntityId;
  type: NotificationType;
  params: NotificationParams;
  target: NotificationTarget;
  readAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
}
