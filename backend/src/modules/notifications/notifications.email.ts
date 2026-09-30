/**
 * "Email updates" (`notificationPreferences.emailEnabled`): notifications a user receives are also
 * emailed, in their language, after the category toggles already applied. Two limits keep this
 * from turning into spam (a busy chat, a professional in a busy area):
 * - at most one `new_message` email per conversation every 30 minutes (the chat is in the app);
 * - at most `perUserPerHour` notification emails per user per hour.
 * Only verified addresses are emailed: otherwise anyone could register someone else's address
 * and have our notifications sent there. Runs in the background; a Redis failure lets emails
 * through (the provider's own limits still apply).
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withinFixedWindow } from '../../infra/fixed-window.js';
import { KEY_SPACES } from '../../infra/keys.js';
import type { AppLanguage } from '../../shared/domain.js';
import { renderNotificationEmail } from './notification-email.js';
import type { NotificationDoc } from './notification.model.js';
import { pushContent } from './push-content.js';

export const NOTIFICATION_EMAIL_LIMITS = {
  perUserPerHour: 10,
  messageEmailGapMs: 30 * 60_000,
} as const;

export interface EmailItem {
  notification: NotificationDoc;
  to: string;
  language: AppLanguage;
}

/** The recipient fields email fan-out needs (read with the preferences, one query). */
export interface EmailRecipient {
  _id: Types.ObjectId;
  email: string;
  emailVerifiedAt?: Date | null;
  language: AppLanguage;
  notificationPreferences: { emailEnabled: boolean };
}

type EmailDeps = Pick<AppDeps, 'mailer' | 'redis' | 'keys' | 'logger'>;

export function wantsEmail(recipient: EmailRecipient | undefined): recipient is EmailRecipient {
  return Boolean(recipient?.notificationPreferences.emailEnabled && recipient.emailVerifiedAt);
}

async function allowed(deps: EmailDeps, item: EmailItem): Promise<boolean> {
  const user = item.notification.user.toHexString();
  const key = (...parts: string[]) => deps.keys.key(KEY_SPACES.rateLimit, 'notification-email', user, ...parts);
  try {
    const { target, type } = item.notification;
    if (type === 'new_message' && target.kind === 'conversation') {
      const first = await deps.redis.set(key('chat', target.conversationId), '1', 'PX', NOTIFICATION_EMAIL_LIMITS.messageEmailGapMs, 'NX');
      if (first !== 'OK') return false;
    }
    return await withinFixedWindow(deps.redis, key('hour'), NOTIFICATION_EMAIL_LIMITS.perUserPerHour, 60 * 60_000);
  } catch (error) {
    deps.logger.warn({ err: error }, 'notification email limits unavailable');
    return true;
  }
}

/** Sends each allowed item; one failure does not stop the others (it is thrown at the end for the log). */
export async function deliverNotificationEmails(deps: EmailDeps, items: EmailItem[]): Promise<void> {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (!(await allowed(deps, item))) return;
      const { title, body } = pushContent(item.notification, item.language);
      await deps.mailer.send(renderNotificationEmail({ to: item.to, language: item.language, title, body }));
    }),
  );
  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length > 0) throw new Error(`${failed.length} of ${items.length} notification emails failed`);
}
