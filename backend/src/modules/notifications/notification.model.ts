/**
 * `notifications`: the in-app inbox. `params`/`target` are stored in their API shape (the app
 * renders the localized text). Deleted by MongoDB after 90 days (TTL).
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import type { NotificationParams, NotificationTarget } from '../../shared/contract/index.js';
import { API_LIMITS } from '../../shared/limits.js';
import { NOTIFICATION_TYPES, type NotificationType } from '../../shared/notification-types.js';

export interface NotificationDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  params: NotificationParams;
  target: NotificationTarget;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    // Plain objects: shapes are fixed by the notification factory, not user input.
    params: { type: Schema.Types.Mixed, required: true },
    target: { type: Schema.Types.Mixed, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: modelTimestamps({ updatedAt: false }), minimize: false, versionKey: false },
);

// GET /notifications (newest first, keyset + totalCount) and the dashboard's recent notifications.
notificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
// Unread: `?unreadOnly=true` list (keyset), unread count, read-all.
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1, _id: -1 });
// A chat's message notifications: marking them read when the chat is opened or answered, and
// collapsing the unread one on each new message. Without it both walk every unread notification
// of the user (professionals collect many unread `new_matching_request`).
notificationSchema.index({ user: 1, 'target.conversationId': 1, readAt: 1 }, { partialFilterExpression: { type: 'new_message' } });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: API_LIMITS.notificationTtlDays * 24 * 60 * 60 });

/**
 * Filter value for "unread". `readAt` is always stored (null until read), and `$type: 'null'` gives
 * the `readAt` indexes one exact bound; `readAt: null` also matches a missing field, and with that
 * second bound the planner preferred walking the user's whole inbox and dropping the read ones.
 */
export const UNREAD = { $type: 'null' } as const;

export const NotificationModel = model<NotificationDoc>('Notification', notificationSchema);
