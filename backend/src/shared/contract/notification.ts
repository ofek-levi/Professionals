import type { CategoryId } from '../catalog/index.js';
import type { NotificationType } from '../notification-types.js';
import type { EntityId, ISODateTimeString } from './common.js';

/** Where tapping a notification navigates to. */
export type NotificationTarget =
  | { kind: 'request'; requestId: EntityId }
  | { kind: 'offer'; offerId: EntityId; requestId: EntityId }
  | { kind: 'job'; jobId: EntityId }
  | { kind: 'conversation'; conversationId: EntityId }
  | { kind: 'professional'; professionalId: EntityId }
  | { kind: 'none' };

/** Structured values the app renders localized texts with. */
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
}

/**
 * The `data` object of every push notification (the app opens `target` when it is tapped). A type
 * alias, not an interface: push payloads are plain JSON records (`Record<string, unknown>`).
 */
export type PushData = {
  notificationId: EntityId;
  notificationType: NotificationType;
  target: NotificationTarget;
};

export interface AppNotification {
  id: EntityId;
  userId: EntityId;
  type: NotificationType;
  params: NotificationParams;
  target: NotificationTarget;
  readAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
}
