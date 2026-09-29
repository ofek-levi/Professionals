import type { Env } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';
import { LogMailer } from './log-mailer.js';
import type { Mailer } from './mailer.js';
import { ResendMailer } from './resend-mailer.js';
import { SmtpMailer } from './smtp-mailer.js';

export type { Mailer, MailMessage } from './mailer.js';
export { MemoryMailer } from './memory-mailer.js';

/** Resend in staging/production (required by env validation), SMTP or the log in development. */
export function createMailer(env: Env, logger: Logger): Mailer {
  if (env.mail.resendApiKey) return new ResendMailer(env.mail.resendApiKey, env.mail.from);
  if (env.mail.smtp) return new SmtpMailer(env.mail.smtp, env.mail.from);
  return new LogMailer(logger);
}
