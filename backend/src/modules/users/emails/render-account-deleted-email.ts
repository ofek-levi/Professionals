/**
 * Renders the "your account was deleted" email as HTML + plain text, in the layout of the other
 * emails (`render-action-email.ts`): a table with inline styles and explicit alignment, Hebrew
 * `dir="rtl"`, and the (LTR) addresses kept in their own direction: `dir="ltr"` in the HTML,
 * isolated inside their sentence in the plain text.
 */
import { LEGAL_CONFIG } from '../../../config/legal.js';
import type { MailMessage } from '../../../infra/mail/index.js';
import { BRAND, directionOf, escapeHtml, startSideOf } from '../../../lib/html.js';
import { isolateText } from '../../../lib/text.js';
import type { AppLanguage } from '../../../shared/domain.js';
import { API_LIMITS } from '../../../shared/limits.js';
import type { DeletionClosed } from '../account-deletion.impact.js';
import { ACCOUNT_DELETED_TEXTS, type DeletionOrigin } from './account-deleted-texts.js';

export interface AccountDeletedEmailInput {
  /** The address the account had (it is erased from the account itself). */
  to: string;
  firstName: string;
  language: AppLanguage;
  /** Who asked for the deletion (the first sentence). */
  via: DeletionOrigin;
  /** What the deletion closed (a sentence only when it closed something). */
  closed: DeletionClosed;
  /** Where to write with questions (the operator's address). */
  contactEmail: string;
}

const EMAIL_SLOT = '\u0000email\u0000';

function withAddress(sentence: (email: string) => string, email: string): { html: string; text: string } {
  return {
    html: escapeHtml(sentence(EMAIL_SLOT)).replace(EMAIL_SLOT, `<span dir="ltr">${escapeHtml(email)}</span>`),
    text: sentence(isolateText(email)),
  };
}

export function renderAccountDeletedEmail(input: AccountDeletedEmailInput): MailMessage {
  const texts = ACCOUNT_DELETED_TEXTS[input.language];
  const kept = texts.kept({
    notificationDays: API_LIMITS.notificationTtlDays,
    logDays: LEGAL_CONFIG.retention.serverLogsDays,
    backupDays: LEGAL_CONFIG.retention.backupsDays,
  });
  const intro = withAddress(texts.intro[input.via], input.to);
  const closed = texts.closed(input.closed);
  const contact = withAddress(texts.contact, input.contactEmail);
  const dir = directionOf(input.language);
  const align = startSideOf(input.language);
  const paragraph = `margin:0 0 16px;font-size:16px;line-height:24px;color:${BRAND.text};text-align:${align};`;
  const subheading = `margin:24px 0 8px;font-size:17px;line-height:24px;color:${BRAND.text};text-align:${align};`;
  // The bullets hang on the start side.
  const listStyle = `margin:0 0 16px;padding:${align === 'left' ? '0 0 0 20px' : '0 20px 0 0'};`;
  const list = (items: string[]) =>
    `<ul dir="${dir}" style="${listStyle}">${items.map((item) => `<li style="margin:0 0 8px;font-size:15px;line-height:22px;color:${BRAND.text};text-align:${align};">${escapeHtml(item)}</li>`).join('')}</ul>`;

  const html = `<!doctype html>
<html lang="${input.language}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(texts.subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.background};font-family:${BRAND.font};" dir="${dir}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px 28px;" dir="${dir}">
<tr><td style="font-size:14px;font-weight:700;letter-spacing:0.4px;color:${BRAND.color};padding-bottom:20px;text-align:${align};">${BRAND.name}</td></tr>
<tr><td><h1 style="margin:0 0 20px;font-size:22px;line-height:30px;color:${BRAND.text};text-align:${align};">${escapeHtml(texts.subject)}</h1>
<p style="${paragraph}">${escapeHtml(texts.greeting(input.firstName))}</p>
<p style="${paragraph}">${intro.html}</p>
${closed === null ? '' : `<p style="${paragraph}">${escapeHtml(closed)}</p>`}
<h2 style="${subheading}">${escapeHtml(texts.removedHeading)}</h2>
${list(texts.removed)}
<h2 style="${subheading}">${escapeHtml(texts.keptHeading)}</h2>
${list(kept)}
<p style="${paragraph}margin-bottom:0;">${contact.html}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const bullets = (items: string[]) => items.map((item) => `- ${item}`);
  const text = [
    texts.greeting(input.firstName),
    '',
    intro.text,
    '',
    ...(closed === null ? [] : [closed, '']),
    `${texts.removedHeading}:`,
    ...bullets(texts.removed),
    '',
    `${texts.keptHeading}:`,
    ...bullets(kept),
    '',
    contact.text,
    '',
    `— ${BRAND.name}`,
  ].join('\n');

  return { to: input.to, subject: texts.subject, html, text };
}
