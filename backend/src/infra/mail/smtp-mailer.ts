import nodemailer, { type Transporter } from 'nodemailer';

import type { SmtpConfig } from '../../config/env.js';
import type { Mailer, MailMessage } from './mailer.js';

/** Gmail SMTP (development): `SMTP_USER` + an app password in `SMTP_PASS`. */
export class SmtpMailer implements Mailer {
  readonly name = 'smtp';
  private readonly transport: Transporter;

  constructor(
    config: SmtpConfig,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}
