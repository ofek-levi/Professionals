/**
 * Cross-module entry point for notifications: every producer (offers, jobs, requests, reviews,
 * messaging, cron) calls `createNotification(s)`. It
 *  1. honours the recipient's category toggle (`jobUpdates`, `messages`, `newRequests`,
 *     `reminders`): disabled → nothing is stored,
 *  2. collapses unread `new_message` notifications of the same conversation into the newest,
 *  3. stores the notification (inside the caller's transaction when `tx` is given),
 *  4. after commit: publishes `notification.created` and, when `pushEnabled`, fans out push in
 *     the background (never delays the response).
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import type { AppNotification } from '../../shared/contract/index.js';
import { NOTIFICATION_TYPE_PREFERENCE } from '../../shared/notification-types.js';
import { UserModel } from '../users/user.model.js';
import { buildNotificationContent, type NotificationInput } from './notification.factory.js';
import { NotificationModel, type NotificationDoc } from './notification.model.js';
import { toNotificationDto } from './notifications.views.js';
import { deliverPush, type PushItem } from './notifications.push.js';

export type { NotificationInput } from './notification.factory.js';

export interface NotificationRequest {
  /** Recipient (`users._id`). */
  userId: Types.ObjectId;
  input: NotificationInput;
}

type NotificationDeps = Pick<AppDeps, 'realtime' | 'push' | 'redis' | 'keys' | 'clock' | 'background'>;

/**
 * Creates notifications for several recipients with one preferences query and one insert.
 * Returns the created DTOs in request order (`null` where the recipient opted out).
 */
export async function createNotifications(
  deps: NotificationDeps,
  requests: NotificationRequest[],
  tx?: Tx,
): Promise<(AppNotification | null)[]> {
  if (requests.length === 0) return [];
  const session = tx?.session;
  const recipients = await UserModel.find(
    { _id: { $in: requests.map((request) => request.userId) } },
    { notificationPreferences: 1, language: 1 },
  )
    .session(session ?? null)
    .lean();
  const byId = new Map(recipients.map((user) => [user._id.toHexString(), user]));

  const accepted = requests.filter(({ userId, input }) => {
    const preferences = byId.get(userId.toHexString())?.notificationPreferences;
    return preferences?.[NOTIFICATION_TYPE_PREFERENCE[input.type]] === true;
  });
  for (const { userId, input } of accepted) {
    if (input.type !== 'new_message') continue;
    await NotificationModel.deleteMany(
      { user: userId, type: 'new_message', 'target.conversationId': input.conversationId.toHexString(), readAt: null },
      { session },
    );
  }
  const created = accepted.length
    ? await NotificationModel.insertMany(
        accepted.map(({ userId, input }) => ({ user: userId, ...buildNotificationContent(input), readAt: null })),
        { session },
      )
    : [];
  const docs = created.map((doc) => doc.toObject<NotificationDoc>());

  const effects = async () => {
    await Promise.all(docs.map((doc) => deps.realtime.publish([doc.user.toHexString()], { type: 'notification.created', notification: toNotificationDto(doc) })));
    const pushItems: PushItem[] = docs.flatMap((doc) => {
      const user = byId.get(doc.user.toHexString());
      return user?.notificationPreferences.pushEnabled ? [{ notification: doc, language: user.language }] : [];
    });
    if (pushItems.length > 0) deps.background.run('push-fan-out', () => deliverPush(deps, pushItems));
  };
  if (tx) tx.afterCommit(effects);
  else await effects();

  const dtoById = new Map(docs.map((doc, index) => [accepted[index], toNotificationDto(doc)]));
  return requests.map((request) => dtoById.get(request) ?? null);
}

/** Single-recipient form of `createNotifications`. */
export async function createNotification(
  deps: NotificationDeps,
  userId: Types.ObjectId,
  input: NotificationInput,
  tx?: Tx,
): Promise<AppNotification | null> {
  const [notification] = await createNotifications(deps, [{ userId, input }], tx);
  return notification ?? null;
}
