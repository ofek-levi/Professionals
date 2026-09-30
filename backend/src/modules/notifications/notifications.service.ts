/**
 * The notification inbox: newest-first list (optionally unread only, optionally without some
 * types), unread count and read marks. Every query is served by the `{user, createdAt, _id}` /
 * `{user, readAt, createdAt, _id}` indexes; an excluded type is filtered on the fetched documents
 * (the only use, the app leaving out `new_message`, skips at most one read notification per burst
 * of chat messages).
 */
import type { ClientSession, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { findPage, NEWEST_FIRST, sortOf, type PageParams } from '../../lib/pagination.js';
import type { AppNotification, Paginated } from '../../shared/contract/index.js';
import type { NotificationType } from '../../shared/notification-types.js';
import { NotificationModel, UNREAD, type NotificationDoc } from './notification.model.js';
import { toNotificationDto } from './notifications.views.js';

const NOTIFICATION_PROJECTION = { user: 1, type: 1, params: 1, target: 1, readAt: 1, createdAt: 1 } as const;

export interface NotificationFilter {
  unreadOnly?: boolean;
  /** Types left out (none by default). */
  excludeTypes?: readonly NotificationType[];
}

export interface ListNotificationsInput extends PageParams, NotificationFilter {}

function inboxFilter(userId: Types.ObjectId, { unreadOnly = false, excludeTypes = [] }: NotificationFilter) {
  return {
    user: userId,
    ...(unreadOnly ? { readAt: UNREAD } : {}),
    ...(excludeTypes.length > 0 ? { type: { $nin: [...excludeTypes] } } : {}),
  };
}

export async function listNotifications(userId: Types.ObjectId, input: ListNotificationsInput): Promise<Paginated<AppNotification>> {
  const page = await findPage<NotificationDoc>(NotificationModel, {
    filter: inboxFilter(userId, input),
    sort: NEWEST_FIRST,
    page: input,
    projection: NOTIFICATION_PROJECTION,
  });
  return { ...page, items: page.items.map(toNotificationDto) };
}

/** Newest notifications of the user (dashboard). */
export async function listRecentNotifications(userId: Types.ObjectId, limit: number): Promise<AppNotification[]> {
  const docs = await NotificationModel.find({ user: userId }, NOTIFICATION_PROJECTION)
    .sort(sortOf(NEWEST_FIRST))
    .limit(limit)
    .lean<NotificationDoc[]>();
  return docs.map(toNotificationDto);
}

export function countUnreadNotifications(userId: Types.ObjectId, excludeTypes: readonly NotificationType[] = []): Promise<number> {
  return NotificationModel.countDocuments(inboxFilter(userId, { unreadOnly: true, excludeTypes }));
}

/** Marks one of the caller's notifications read (idempotent); 404 unknown, 403 someone else's. */
export async function markNotificationRead(
  deps: Pick<AppDeps, 'clock'>,
  userId: Types.ObjectId,
  notificationId: Types.ObjectId,
): Promise<AppNotification> {
  const updated = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, user: userId, readAt: UNREAD },
    { $set: { readAt: deps.clock.now() } },
    { returnDocument: 'after', projection: NOTIFICATION_PROJECTION },
  ).lean<NotificationDoc>();
  if (updated) return toNotificationDto(updated);
  const existing = await NotificationModel.findById(notificationId, NOTIFICATION_PROJECTION).lean<NotificationDoc>();
  if (!existing) throw ApiError.notFound('Notification');
  if (!existing.user.equals(userId)) throw ApiError.forbidden('This notification belongs to another user');
  return toNotificationDto(existing);
}

/** Returns how many notifications changed. */
export async function markAllNotificationsRead(deps: Pick<AppDeps, 'clock'>, userId: Types.ObjectId): Promise<number> {
  const { modifiedCount } = await NotificationModel.updateMany({ user: userId, readAt: UNREAD }, { $set: { readAt: deps.clock.now() } });
  return modifiedCount;
}

/** Opening (or replying in) a chat reads its message notifications (the only type targeting a chat). */
export async function markConversationNotificationsRead(
  userId: Types.ObjectId,
  conversationId: Types.ObjectId,
  readAt: Date,
  session?: ClientSession,
): Promise<void> {
  await NotificationModel.updateMany(
    { user: userId, type: 'new_message', 'target.conversationId': conversationId.toHexString(), readAt: UNREAD },
    { $set: { readAt } },
    { session },
  );
}
