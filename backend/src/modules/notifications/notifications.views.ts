import type { AppNotification } from '../../shared/contract/index.js';
import type { NotificationDoc } from './notification.model.js';

export function toNotificationDto(doc: NotificationDoc): AppNotification {
  return {
    id: doc._id.toHexString(),
    userId: doc.user.toHexString(),
    type: doc.type,
    params: doc.params,
    target: doc.target,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}
