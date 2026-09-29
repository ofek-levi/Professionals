/** Sends the auth emails (verification, password reset) with a fresh single-use link. */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { AppLanguage } from '../../shared/domain.js';
import { RESET_PASSWORD_TEXTS, VERIFY_EMAIL_TEXTS } from './emails/auth-email-texts.js';
import { renderActionEmail } from './emails/render-action-email.js';
import { issueEmailToken } from './email-token.service.js';

type MailDeps = Pick<AppDeps, 'env' | 'clock' | 'mailer'>;

export interface MailRecipient {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  language: AppLanguage;
}

export const MAIL_RECIPIENT_PROJECTION = { email: 1, firstName: 1, language: 1 } as const;

function linkTo(deps: MailDeps, page: 'verify-email' | 'reset-password', token: string): string {
  return `${deps.env.publicApiUrl}/v1/auth/${page}?token=${token}`;
}

export async function sendVerificationEmail(deps: MailDeps, user: MailRecipient): Promise<void> {
  const token = await issueEmailToken(user._id, 'verify_email', deps.clock.now());
  const link = linkTo(deps, 'verify-email', token);
  await deps.mailer.send(renderActionEmail(VERIFY_EMAIL_TEXTS[user.language], { to: user.email, firstName: user.firstName, language: user.language, link }));
}

export async function sendPasswordResetEmail(deps: MailDeps, user: MailRecipient): Promise<void> {
  const token = await issueEmailToken(user._id, 'reset_password', deps.clock.now());
  const link = linkTo(deps, 'reset-password', token);
  await deps.mailer.send(renderActionEmail(RESET_PASSWORD_TEXTS[user.language], { to: user.email, firstName: user.firstName, language: user.language, link }));
}
