/**
 * Pages opened from the auth emails: verify-email and the password reset form. GET only shows a
 * page (a confirm button, the reset form); the POST from that page acts. So email scanners that
 * prefetch links can neither verify an address nor burn a reset link.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { ApiError, isApiError } from '../../lib/errors.js';
import { clientIpKey } from '../../middleware/rate-limit.js';
import type { AppLanguage } from '../../shared/domain.js';
import { vm, type ValidationMessage } from '../../shared/validation-messages.js';
import { verifyEmail, verifyLinkAccount } from './email-verification.service.js';
import { PAGE_TEXTS } from './pages/page-texts.js';
import { renderMessagePage, renderResetForm, renderVerifyConfirm } from './pages/render-page.js';
import { resetLinkAccount, resetPassword } from './password-reset.service.js';
import { newPasswordIssue } from './password-rules.js';

const MAX_TOKEN_LENGTH = 200;

function stringField(source: unknown, name: string): string {
  const value = (source as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : '';
}

function linkToken(value: string): string | null {
  const token = value.trim();
  return token && token.length <= MAX_TOKEN_LENGTH ? token : null;
}

/** Language of a page not tied to an account (invalid link): the browser's preference. */
function browserLanguage(req: Request): AppLanguage {
  return req.acceptsLanguages('en', 'he') === 'he' ? 'he' : 'en';
}

interface HtmlPage {
  status: number;
  html: string;
}

/**
 * Pages need no scripts, images or external resources: a strict policy of their own replaces the
 * API-wide one (which would also upgrade the form post to https on a plain-http dev machine).
 */
const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

/** Pages carry single-use tokens, so never cached. */
function sendPage(res: Response, page: HtmlPage): void {
  res.status(page.status).set({ 'Cache-Control': 'no-store', 'Content-Security-Policy': PAGE_CSP }).type('html').send(page.html);
}

/** Sends the page a controller renders. */
function htmlPage(render: (req: Request) => Promise<HtmlPage>): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendPage(res, await render(req));
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Rate-limit refusal of the pages and their form posts (`onRefused`): a 429 page in the browser's
 * language; JSON posts to `/auth/reset-password` (API clients) get the usual 429 error.
 */
export function tooManyRequestsPage(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'POST' && !req.is('application/x-www-form-urlencoded')) {
    next(ApiError.rateLimited());
    return;
  }
  const language = browserLanguage(req);
  sendPage(res, { status: 429, html: renderMessagePage(language, PAGE_TEXTS[language].tooManyRequests, 'error') });
}

function invalidLinkPage(req: Request, page: 'verifyLinkInvalid' | 'resetLinkInvalid'): HtmlPage {
  const language = browserLanguage(req);
  return { status: 400, html: renderMessagePage(language, PAGE_TEXTS[language][page], 'error') };
}

/** `GET /auth/verify-email?token=`: the confirmation page (verifies nothing). */
export const verifyEmailPage = (deps: AppDeps) =>
  htmlPage(async (req) => {
    const token = linkToken(stringField(req.query, 'token'));
    const account = token ? await verifyLinkAccount(deps, token) : null;
    if (!token || !account) return invalidLinkPage(req, 'verifyLinkInvalid');
    return { status: 200, html: renderVerifyConfirm(account.language, { token, email: account.email }) };
  });

/** `POST /auth/verify-email` from the confirmation page's button. */
export const verifyEmailFormSubmit = (deps: AppDeps) =>
  htmlPage(async (req) => {
    const token = linkToken(stringField(req.body, 'token'));
    const verified = token ? await verifyEmail(deps, token) : null;
    if (!verified) return invalidLinkPage(req, 'verifyLinkInvalid');
    return { status: 200, html: renderMessagePage(verified.language, PAGE_TEXTS[verified.language].emailVerified, 'success') };
  });

export const resetPasswordPage = (deps: AppDeps) =>
  htmlPage(async (req) => {
    const token = linkToken(stringField(req.query, 'token'));
    const account = token ? await resetLinkAccount(deps, token) : null;
    if (!token || !account) return invalidLinkPage(req, 'resetLinkInvalid');
    return { status: 200, html: renderResetForm(account.language, { token, email: account.email }) };
  });

/** Same rules as the app's sign-up form: the new-password rules, then the confirmation. */
function formErrors(password: string, confirmPassword: string) {
  const confirm: ValidationMessage | null =
    confirmPassword.length === 0 ? vm('auth.confirmPasswordRequired') : confirmPassword !== password ? vm('auth.passwordMismatch') : null;
  return { password: newPasswordIssue(password), confirmPassword: confirm };
}

export const resetPasswordFormSubmit = (deps: AppDeps) =>
  htmlPage(async (req) => {
    const token = linkToken(stringField(req.body, 'token'));
    const account = token ? await resetLinkAccount(deps, token) : null;
    if (!token || !account) return invalidLinkPage(req, 'resetLinkInvalid');

    const password = stringField(req.body, 'password');
    const errors = formErrors(password, stringField(req.body, 'confirmPassword'));
    const texts = PAGE_TEXTS[account.language];
    if (errors.password || errors.confirmPassword) {
      const translated = {
        password: errors.password ? texts.errors[errors.password] : undefined,
        confirmPassword: errors.confirmPassword ? texts.errors[errors.confirmPassword] : undefined,
      };
      return { status: 400, html: renderResetForm(account.language, { token, email: account.email, errors: translated }) };
    }
    try {
      await resetPassword(deps, { token, password }, clientIpKey(req));
    } catch (error) {
      if (!isApiError(error) || error.status !== 400) throw error;
      // A breached password: back to the form with the message; otherwise the link was used up in
      // the meantime (e.g. the form was submitted twice).
      const passwordIssue = error.fieldErrors?.password?.[0] as ValidationMessage | undefined;
      if (!passwordIssue) return invalidLinkPage(req, 'resetLinkInvalid');
      return { status: 400, html: renderResetForm(account.language, { token, email: account.email, errors: { password: texts.errors[passwordIssue] } }) };
    }
    return { status: 200, html: renderMessagePage(account.language, texts.passwordChanged, 'success') };
  });
