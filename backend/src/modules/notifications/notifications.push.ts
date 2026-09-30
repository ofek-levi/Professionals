/**
 * Push fan-out: every stored notification of a user with push enabled goes to each of their
 * devices whose registering session is still live (Expo, chunked by the sender). A device of an
 * ended session (expired by the TTL, or a sign-out the server never received) is skipped and
 * deleted: a signed-out phone never shows the account's notifications. The data payload
 * (`PushData`: `{ notificationId, notificationType, target }`) lets the app mark the notification
 * read and deep-link exactly like the inbox. Tokens Expo rejects as unregistered, or that are not Expo tokens, are
 * deleted; the other tickets wait in Redis for the receipts cron. A failed request to Expo is
 * thrown after the rest was handled, so the background runner logs it.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { DEVICE_NOT_REGISTERED, SEND_FAILED, type PushMessage } from '../../infra/push/index.js';
import type { PushData } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { SessionModel } from '../auth/session.model.js';
import { DeviceModel, type DeviceDoc } from '../users/device.model.js';
import type { NotificationDoc } from './notification.model.js';
import { pushContent } from './push-content.js';
import { savePushTickets } from './push-tickets.js';

export interface PushItem {
  notification: NotificationDoc;
  language: AppLanguage;
}

type PushDeps = Pick<AppDeps, 'push' | 'redis' | 'keys' | 'clock'>;

type DeviceRow = Pick<DeviceDoc, '_id' | 'user' | 'session' | 'token'>;

/**
 * The recipients' devices whose session is live. Devices of ended sessions are deleted (only if
 * still on that session: a registration from a new session in between keeps the device).
 */
async function liveDevices(deps: PushDeps, userIds: Types.ObjectId[]): Promise<DeviceRow[]> {
  const devices = await DeviceModel.find({ user: { $in: userIds } }, { user: 1, session: 1, token: 1 }).lean<DeviceRow[]>();
  if (devices.length === 0) return [];
  const sessions = await SessionModel.find(
    { _id: { $in: [...new Set(devices.map((device) => device.session.toHexString()))] }, expiresAt: { $gt: deps.clock.now() } },
    { _id: 1 },
  ).lean();
  const live = new Set(sessions.map((session) => session._id.toHexString()));
  const ended = devices.filter((device) => !live.has(device.session.toHexString()));
  if (ended.length > 0) {
    await DeviceModel.deleteMany({ $or: ended.map((device) => ({ _id: device._id, session: device.session })) });
  }
  return devices.filter((device) => live.has(device.session.toHexString()));
}

export async function deliverPush(deps: PushDeps, items: PushItem[]): Promise<void> {
  if (items.length === 0) return;
  const devices = await liveDevices(deps, items.map((item) => item.notification.user));
  const tokensByUser = new Map<string, string[]>();
  const invalidTokens: string[] = [];
  for (const device of devices) {
    if (!deps.push.isValidToken(device.token)) {
      invalidTokens.push(device.token);
      continue;
    }
    const key = device.user.toHexString();
    const tokens = tokensByUser.get(key);
    if (tokens) tokens.push(device.token);
    else tokensByUser.set(key, [device.token]);
  }

  const messages: PushMessage[] = items.flatMap(({ notification, language }) => {
    const { title, body } = pushContent(notification, language);
    const data: PushData = { notificationId: notification._id.toHexString(), notificationType: notification.type, target: notification.target };
    return (tokensByUser.get(notification.user.toHexString()) ?? []).map((to) => ({ to, title, body, data }));
  });

  const tickets = messages.length > 0 ? await deps.push.send(messages) : [];
  const unregistered = tickets.filter((ticket) => ticket.error === DEVICE_NOT_REGISTERED).map((ticket) => ticket.token);
  const stale = [...invalidTokens, ...unregistered];
  if (stale.length > 0) await DeviceModel.deleteMany({ token: { $in: stale } });
  await savePushTickets(
    deps.redis,
    deps.keys,
    tickets.flatMap((ticket) => (ticket.ticketId ? [{ ticketId: ticket.ticketId, token: ticket.token }] : [])),
    deps.clock.now(),
  );
  const failed = tickets.filter((ticket) => ticket.error === SEND_FAILED).length;
  if (failed > 0) throw new Error(`Expo push request failed for ${failed} of ${tickets.length} messages`);
}
