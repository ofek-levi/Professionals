/**
 * The "Email updates" email of one notification: the same title and text as its push (en/he), a
 * pointer to the app, and how to turn these emails off. Table layout with inline styles, explicit
 * alignment and `dir` (email clients ignore <style> and logical CSS).
 */
import type { MailMessage } from '../../infra/mail/index.js';
import { BRAND, directionOf, escapeHtml, startSideOf } from '../../lib/html.js';
import type { AppLanguage } from '../../shared/domain.js';

const FOOTER: Record<AppLanguage, { openApp: string; why: string }> = {
  en: {
    openApp: 'Open the Professionals app to see the details.',
    why: 'You get these emails because “Email updates” is on. You can turn it off in the app: Settings → Notifications.',
  },
  he: {
    openApp: 'לפרטים המלאים פתחו את אפליקציית Professionals.',
    why: 'קיבלתם את האימייל הזה כי ״עדכונים באימייל״ מופעלים. אפשר לכבות אותם באפליקציה: הגדרות ← התראות.',
  },
};

export function renderNotificationEmail(input: { to: string; language: AppLanguage; title: string; body: string }): MailMessage {
  const { language } = input;
  const dir = directionOf(language);
  const align = startSideOf(language);
  const footer = FOOTER[language];
  const paragraph = `margin:0 0 16px;font-size:16px;line-height:24px;color:${BRAND.text};text-align:${align};`;
  const small = `margin:0;font-size:13px;line-height:20px;color:${BRAND.muted};text-align:${align};`;
  const html = `<!doctype html>
<html lang="${language}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.background};font-family:${BRAND.font};" dir="${dir}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px 28px;" dir="${dir}">
<tr><td style="font-size:14px;font-weight:700;letter-spacing:0.4px;color:${BRAND.color};padding-bottom:20px;text-align:${align};">${BRAND.name}</td></tr>
<tr><td><h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${BRAND.text};text-align:${align};">${escapeHtml(input.title)}</h1>
<p style="${paragraph}">${escapeHtml(input.body)}</p>
<p style="${paragraph}">${escapeHtml(footer.openApp)}</p>
<p style="${small}">${escapeHtml(footer.why)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [input.title, '', input.body, '', footer.openApp, '', footer.why, '', `— ${BRAND.name}`].join('\n');
  return { to: input.to, subject: input.title, html, text };
}
