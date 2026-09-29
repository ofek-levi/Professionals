import type { Logger } from '../../lib/logger.js';
import type { Mailer, MailMessage } from './mailer.js';

/**
 * Development fallback without SMTP credentials: the text part (with its links) is logged so a
 * developer can follow verification/reset links locally. Never used in staging/production.
 */
export class LogMailer implements Mailer {
  readonly name = 'log';

  constructor(private readonly logger: Logger) {}

  send(message: MailMessage): Promise<void> {
    this.logger.info({ mail: { to: message.to, subject: message.subject, text: message.text } }, 'email (not sent: SMTP not configured)');
    return Promise.resolve();
  }
}
