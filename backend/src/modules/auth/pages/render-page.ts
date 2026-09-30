/**
 * Small server-rendered pages opened from the auth emails (no scripts: the CSP forbids inline
 * scripts; inline styles are allowed). Hebrew pages are right-to-left.
 */
import type { AppLanguage } from '../../../shared/domain.js';
import { BRAND, directionOf, escapeHtml } from '../../../lib/html.js';
import { PAGE_TEXTS, type MessagePageTexts } from './page-texts.js';

const STYLES = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:${BRAND.background};font-family:${BRAND.font};color:${BRAND.text}}
main{width:100%;max-width:440px;background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 2px 12px rgba(16,24,40,.08)}
.brand{margin:0 0 20px;font-size:14px;font-weight:700;letter-spacing:.4px;color:${BRAND.color}}
h1{margin:0 0 12px;font-size:22px;line-height:1.35}
p{margin:0 0 16px;font-size:16px;line-height:1.5;color:${BRAND.muted}}
.status{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;margin-bottom:16px}
.success{background:#e6f4ea;color:#1e7e34}.error{background:#fdecea;color:#b42318}
label{display:block;margin:16px 0 6px;font-size:14px;font-weight:600}
input[type=password]{width:100%;padding:12px 14px;font-size:16px;border:1px solid #c9d1db;border-radius:10px;background:#fff;color:inherit}
input[aria-invalid=true]{border-color:#b42318}
.hint{margin:6px 0 0;font-size:13px}.note{margin:20px 0 0;font-size:14px}.field-error{margin:6px 0 0;font-size:13px;color:#b42318}
button{margin-top:24px;width:100%;padding:13px;font-size:16px;font-weight:600;color:#fff;background:${BRAND.color};border:0;border-radius:10px;cursor:pointer}
`;

function document(language: AppLanguage, title: string, content: string): string {
  return `<!doctype html>
<html lang="${language}" dir="${directionOf(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · ${BRAND.name}</title>
<style>${STYLES}</style>
</head>
<body><main><p class="brand">${BRAND.name}</p>${content}</main></body>
</html>`;
}

export function renderMessagePage(language: AppLanguage, texts: MessagePageTexts, tone: 'success' | 'error'): string {
  const icon = tone === 'success' ? '✓' : '!';
  return document(
    language,
    texts.title,
    `<div class="status ${tone}" aria-hidden="true">${icon}</div><h1>${escapeHtml(texts.title)}</h1><p>${escapeHtml(texts.message)}</p>`,
  );
}

export interface ResetFormState {
  token: string;
  email: string;
  /** Translated error per field. */
  errors?: { password?: string | undefined; confirmPassword?: string | undefined };
}

function passwordField(name: 'password' | 'confirmPassword', label: string, error: string | undefined, hint?: string): string {
  const described = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(' ');
  return `<label for="${name}">${escapeHtml(label)}</label>
<input id="${name}" name="${name}" type="password" autocomplete="new-password" required minlength="8" maxlength="64"${
    described ? ` aria-describedby="${described}"` : ''
  }${error ? ' aria-invalid="true"' : ''}>
${hint ? `<p class="hint" id="${name}-hint">${escapeHtml(hint)}</p>` : ''}${
    error ? `<p class="field-error" id="${name}-error" role="alert">${escapeHtml(error)}</p>` : ''
  }`;
}

/** The form posts (relative URL, so it works behind any path prefix) to `POST …/auth/reset-password`. */
export function renderResetForm(language: AppLanguage, state: ResetFormState): string {
  const texts = PAGE_TEXTS[language].resetForm;
  return document(
    language,
    texts.title,
    `<h1>${escapeHtml(texts.title)}</h1><p><span dir="ltr">${escapeHtml(state.email)}</span></p>
<form method="post" action="reset-password">
<input type="hidden" name="token" value="${escapeHtml(state.token)}">
<input type="email" name="username" autocomplete="username" value="${escapeHtml(state.email)}" hidden>
${passwordField('password', texts.password, state.errors?.password, texts.hint)}
${passwordField('confirmPassword', texts.confirmPassword, state.errors?.confirmPassword)}
<button type="submit">${escapeHtml(texts.submit)}</button>
</form>`,
  );
}

/**
 * Confirmation step of the verify link: email scanners and link previews fetch the GET without
 * verifying anything; only the button (a POST to `…/auth/verify-email`) does.
 */
export function renderVerifyConfirm(language: AppLanguage, state: { token: string; email: string }): string {
  const texts = PAGE_TEXTS[language].verifyConfirm;
  return document(
    language,
    texts.title,
    `<h1>${escapeHtml(texts.title)}</h1><p>${escapeHtml(texts.message)}</p><p><strong dir="ltr">${escapeHtml(state.email)}</strong></p>
<form method="post" action="verify-email">
<input type="hidden" name="token" value="${escapeHtml(state.token)}">
<button type="submit">${escapeHtml(texts.submit)}</button>
</form>
<p class="note">${escapeHtml(texts.notYou)}</p>`,
  );
}
