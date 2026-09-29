import { Resend } from 'resend';

import type { Mailer, MailMessage } from './mailer.js';

export class ResendMailer implements Mailer {
  readonly name = 'resend';
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: MailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) throw new Error(`Resend rejected the email: ${error.name}: ${error.message}`);
  }
}
