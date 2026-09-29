/**
 * Outgoing email. Development sends through Gmail SMTP (nodemailer) or, without SMTP
 * credentials, writes the message to the log; staging/production send through Resend. Tests use
 * `MemoryMailer`. Templates live with the module that sends them (e.g. auth emails).
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative (always provided). */
  text: string;
}

export interface Mailer {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}
