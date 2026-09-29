import type { Mailer, MailMessage } from './mailer.js';

/** In-memory mailer for tests: inspect `sent`. */
export class MemoryMailer implements Mailer {
  readonly name = 'memory';
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  /** Newest message sent to `to`. */
  lastTo(to: string): MailMessage | undefined {
    return this.sent.filter((message) => message.to === to).at(-1);
  }
}
