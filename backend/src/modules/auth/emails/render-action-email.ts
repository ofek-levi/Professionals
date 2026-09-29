/**
 * Renders a "click this button" email (verification, password reset) as HTML + plain text.
 * Email clients ignore <style> blocks and logical CSS, so the layout is a table with inline styles
 * and explicit left/right alignment; Hebrew mails are `dir="rtl"` with the (LTR) email address and
 * link isolated so they are not reordered.
 */
import type { MailMessage } from '../../../infra/mail/index.js';
import type { AppLanguage } from '../../../shared/domain.js';
import { BRAND, directionOf, escapeHtml, startSideOf } from '../html.js';
import type { ActionEmailTexts } from './auth-email-texts.js';

export interface ActionEmailInput {
  to: string;
  firstName: string;
  language: AppLanguage;
  link: string;
}

const EMAIL_SLOT = '\u0000email\u0000';
/** Unicode first-strong isolate: keeps an LTR address intact inside Hebrew plain text. */
const isolate = (value: string) => `⁨${value}⁩`;

export function renderActionEmail(texts: ActionEmailTexts, input: ActionEmailInput): MailMessage {
  const dir = directionOf(input.language);
  const align = startSideOf(input.language);
  const link = escapeHtml(input.link);
  const body = escapeHtml(texts.body(EMAIL_SLOT)).replace(EMAIL_SLOT, `<span dir="ltr">${escapeHtml(input.to)}</span>`);
  const paragraph = `margin:0 0 16px;font-size:16px;line-height:24px;color:${BRAND.text};text-align:${align};`;
  const small = `margin:0 0 12px;font-size:13px;line-height:20px;color:${BRAND.muted};text-align:${align};`;

  const html = `<!doctype html>
<html lang="${input.language}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(texts.subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.background};font-family:${BRAND.font};" dir="${dir}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px 28px;" dir="${dir}">
<tr><td style="font-size:14px;font-weight:700;letter-spacing:0.4px;color:${BRAND.color};padding-bottom:20px;text-align:${align};">${BRAND.name}</td></tr>
<tr><td><h1 style="margin:0 0 20px;font-size:22px;line-height:30px;color:${BRAND.text};text-align:${align};">${escapeHtml(texts.heading)}</h1>
<p style="${paragraph}">${escapeHtml(texts.greeting(input.firstName))}</p>
<p style="${paragraph}">${body}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;" align="${align}"><tr>
<td style="border-radius:8px;background:${BRAND.color};"><a href="${link}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(texts.action)}</a></td>
</tr></table>
<p style="${small}clear:both;">${escapeHtml(texts.linkHint)}<br><a href="${link}" dir="ltr" style="color:${BRAND.color};word-break:break-all;">${link}</a></p>
<p style="${small}">${escapeHtml(texts.expiry)}</p>
<p style="${small}margin-bottom:0;">${escapeHtml(texts.ignore)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    texts.greeting(input.firstName),
    '',
    texts.body(isolate(input.to)),
    '',
    `${texts.action}:`,
    isolate(input.link),
    '',
    texts.expiry,
    texts.ignore,
    '',
    `— ${BRAND.name}`,
  ].join('\n');

  return { to: input.to, subject: texts.subject, html, text };
}
