/**
 * Creates and stores notifications (built by the shared notification factory), respects each
 * user's notification preferences and fans out realtime events to every affected user.
 */
import { NOTIFICATION_TYPE_META } from '@/constants/notification-types';
import { buildNotification, type NotificationInput } from '../notification-factory';
import { DomainError } from '@/features/shared/domain-error';
import type { NotificationsParams, Paginated } from '@/types/api';
import type { AppNotification, NotificationPreferences, Offer, ServiceRequest } from '@/types/domain';

import type { ServerContext } from '../context';
import type { StoredJob } from '../db';
import { compareNewestFirst, paginateNewestFirst } from '../pagination';
import { findProfessionalByUserId, offersForRequest, professionalUserId, requireRequest } from '../queries';

function preferencesOf(ctx: ServerContext, userId: string): NotificationPreferences | null {
  const user = ctx.db.users.get(userId);
  if (!user) return null;
  if (user.role === 'customer') return ctx.db.customerProfiles.get(userId)?.notificationPreferences ?? null;
  return findProfessionalByUserId(ctx.db, userId)?.notificationPreferences ?? null;
}

/** Whether the recipient opted in to this notification category. */
function wantsNotification(ctx: ServerContext, userId: string, type: AppNotification['type']): boolean {
  const preferences = preferencesOf(ctx, userId);
  if (!preferences) return false;
  return preferences[NOTIFICATION_TYPE_META[type].preference];
}

/**
 * Stores a notification for `userId` and pushes `notification.created`. Returns `null` when the
 * user disabled this category. Unread `new_message` notifications of the same conversation are
 * collapsed into the newest one.
 */
export function notify(ctx: ServerContext, userId: string, input: NotificationInput): AppNotification | null {
  if (!wantsNotification(ctx, userId, input.type)) return null;
  if (input.type === 'new_message') {
    const stale = ctx.db.notifications.filter(
      (notification) =>
        notification.userId === userId &&
        notification.type === 'new_message' &&
        notification.readAt === null &&
        notification.target.kind === 'conversation' &&
        notification.target.conversationId === input.conversationId,
    );
    stale.forEach((notification) => ctx.db.notifications.delete(notification.id));
  }
  const notification = ctx.db.notifications.insert(
    buildNotification(input, { id: ctx.newId('ntf'), userId, now: ctx.now() }),
  );
  ctx.emit(userId, { type: 'notification.created', notification });
  return notification;
}

// ────────────────────────────── Entity change events ──────────────────────────────

/** Users that care about a request: its owner and every professional who sent an offer. */
function requestAudience(ctx: ServerContext, request: ServiceRequest): Set<string> {
  const audience = new Set<string>([request.customerId]);
  for (const offer of offersForRequest(ctx.db, request.id)) audience.add(professionalUserId(ctx.db, offer.professionalId));
  return audience;
}

export function emitRequestUpdated(ctx: ServerContext, request: ServiceRequest, extraUserIds: Iterable<string> = []): void {
  const audience = requestAudience(ctx, request);
  for (const userId of extraUserIds) audience.add(userId);
  audience.forEach((userId) => ctx.emit(userId, { type: 'request.updated', requestId: request.id }));
}

export function emitOfferUpdated(ctx: ServerContext, offer: Offer): void {
  const request = requireRequest(ctx.db, offer.requestId);
  const event = { type: 'offer.updated', offerId: offer.id, requestId: offer.requestId } as const;
  ctx.emit(request.customerId, event);
  ctx.emit(professionalUserId(ctx.db, offer.professionalId), event);
}

export function emitJobUpdated(ctx: ServerContext, job: StoredJob): void {
  const event = { type: 'job.updated', jobId: job.id, requestId: job.requestId } as const;
  ctx.emit(job.customerId, event);
  ctx.emit(professionalUserId(ctx.db, job.professionalId), event);
}

export function emitProfileUpdated(ctx: ServerContext, professionalId: string): void {
  ctx.emit(professionalUserId(ctx.db, professionalId), { type: 'profile.updated', professionalId });
}

// ────────────────────────────── Notification inbox ──────────────────────────────

export function listNotifications(ctx: ServerContext, userId: string, params: NotificationsParams): Paginated<AppNotification> {
  const items = ctx.db.notifications.filter(
    (notification) => notification.userId === userId && (!params.unreadOnly || notification.readAt === null),
  );
  return paginateNewestFirst(items, params);
}

export function unreadNotificationCount(ctx: ServerContext, userId: string): number {
  return ctx.db.notifications.count((notification) => notification.userId === userId && notification.readAt === null);
}

export function recentNotifications(ctx: ServerContext, userId: string, limit: number): AppNotification[] {
  return ctx.db.notifications
    .filter((notification) => notification.userId === userId)
    .sort(compareNewestFirst)
    .slice(0, limit);
}

export function markNotificationRead(ctx: ServerContext, userId: string, notificationId: string): AppNotification {
  const notification = ctx.db.notifications.require(notificationId, 'Notification');
  if (notification.userId !== userId) throw DomainError.forbidden('This notification belongs to another user');
  if (notification.readAt !== null) return notification;
  return ctx.db.notifications.update(notification.id, { readAt: ctx.nowIso() });
}

export function markAllNotificationsRead(ctx: ServerContext, userId: string): number {
  const unread = ctx.db.notifications.filter((notification) => notification.userId === userId && notification.readAt === null);
  const readAt = ctx.nowIso();
  unread.forEach((notification) => ctx.db.notifications.update(notification.id, { readAt }));
  return unread.length;
}

/** Marks the user's message notifications of a conversation as read (when they open the chat). */
export function markConversationNotificationsRead(ctx: ServerContext, userId: string, conversationId: string): void {
  const readAt = ctx.nowIso();
  ctx.db.notifications
    .filter(
      (notification) =>
        notification.userId === userId &&
        notification.readAt === null &&
        notification.target.kind === 'conversation' &&
        notification.target.conversationId === conversationId,
    )
    .forEach((notification) => ctx.db.notifications.update(notification.id, { readAt }));
}
