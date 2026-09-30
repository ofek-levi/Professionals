/**
 * Push fan-out: every stored notification of a user with push enabled goes to the push token of
 * each of their live sessions (Expo, chunked by the sender). Tokens live on sessions, so a
 * signed-out, revoked or expired session has none left: a signed-out phone never shows the
 * account's notifications. The data payload (`PushData`: `{ notificationId, notificationType,
 * target }`) lets the app mark the notification read and deep-link exactly like the inbox. Tokens
 * Expo rejects as unregistered, or that are not Expo tokens, are removed from their session; the
 * other tickets wait in Redis for the receipts cron. A failed request to Expo is thrown after the
 * rest was handled, so the background runner logs it.
 */
import type { AppDeps } from '../../deps.js';
import { DEVICE_NOT_REGISTERED, SEND_FAILED, type PushMessage } from '../../infra/push/index.js';
import type { PushData } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { forgetPushTokens, pushTargetsOf } from '../auth/push-token.service.js';
import type { NotificationDoc } from './notification.model.js';
import { pushContent } from './push-content.js';
import { savePushTickets } from './push-tickets.js';

export interface PushItem {
  notification: NotificationDoc;
  language: AppLanguage;
}

type PushDeps = Pick<AppDeps, 'push' | 'redis' | 'keys' | 'clock'>;

export async function deliverPush(deps: PushDeps, items: PushItem[]): Promise<void> {
  if (items.length === 0) return;
  const targets = await pushTargetsOf(items.map((item) => item.notification.user), deps.clock.now());
  const tokensByUser = new Map<string, string[]>();
  const invalidTokens: string[] = [];
  for (const { user, pushToken } of targets) {
    if (!deps.push.isValidToken(pushToken)) {
      invalidTokens.push(pushToken);
      continue;
    }
    const key = user.toHexString();
    const tokens = tokensByUser.get(key);
    if (tokens) tokens.push(pushToken);
    else tokensByUser.set(key, [pushToken]);
  }

  const messages: PushMessage[] = items.flatMap(({ notification, language }) => {
    const { title, body } = pushContent(notification, language);
    const data: PushData = { notificationId: notification._id.toHexString(), notificationType: notification.type, target: notification.target };
    return (tokensByUser.get(notification.user.toHexString()) ?? []).map((to) => ({ to, title, body, data }));
  });

  const tickets = messages.length > 0 ? await deps.push.send(messages) : [];
  const unregistered = tickets.filter((ticket) => ticket.error === DEVICE_NOT_REGISTERED).map((ticket) => ticket.token);
  await forgetPushTokens([...invalidTokens, ...unregistered]);
  await savePushTickets(
    deps.redis,
    deps.keys,
    tickets.flatMap((ticket) => (ticket.ticketId ? [{ ticketId: ticket.ticketId, token: ticket.token }] : [])),
    deps.clock.now(),
  );
  const failed = tickets.filter((ticket) => ticket.error === SEND_FAILED).length;
  if (failed > 0) throw new Error(`Expo push request failed for ${failed} of ${tickets.length} messages`);
}
