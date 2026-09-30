/**
 * `/auth/*`: public endpoints (no `requireAuth`, except resending the verification email) with Redis rate limits: generous per-IP caps (many
 * mobile users share one carrier IP), per (email, IP) for sign-up, per session for refresh. Failed
 * sign-ins are limited by the login throttle and reset emails by a per-address budget, both inside
 * the services, in ways a stranger cannot use to lock the owner out. The HTML forms post
 * URL-encoded data and get HTML back (a 429 too); the reset path also accepts JSON for API clients.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { emailAndIpKey, RATE_LIMITS, rateLimit, userKey, type RateLimitRule } from '../../middleware/rate-limit.js';
import {
  passwordReset,
  refresh,
  registerAccount,
  resendVerification,
  resetPasswordJson,
  signInGoogle,
  signInWithPassword,
  signOut,
} from './auth.controller.js';
import { resetPasswordFormSubmit, resetPasswordPage, tooManyRequestsPage, verifyEmailFormSubmit, verifyEmailPage } from './auth-pages.controller.js';
import { refreshSessionKey } from './refresh-token.js';

export function createAuthRouter(deps: AppDeps): Router {
  const router = Router();
  router.post(
    '/auth/register',
    rateLimit(deps, 'register-ip', RATE_LIMITS.registerPerIp),
    rateLimit(deps, 'register-email-ip', { ...RATE_LIMITS.registerPerEmailAndIp, key: emailAndIpKey }),
    asyncHandler(registerAccount(deps), { status: 201 }),
  );
  router.post('/auth/login', rateLimit(deps, 'login-ip', RATE_LIMITS.loginPerIp), asyncHandler(signInWithPassword(deps)));
  router.post('/auth/google', rateLimit(deps, 'google-ip', RATE_LIMITS.googlePerIp), asyncHandler(signInGoogle(deps)));
  router.post(
    '/auth/refresh',
    rateLimit(deps, 'refresh-ip', RATE_LIMITS.refreshPerIp),
    rateLimit(deps, 'refresh-session', { ...RATE_LIMITS.refreshPerSession, key: refreshSessionKey(deps.env.jwt.accessSecret) }),
    asyncHandler(refresh(deps)),
  );
  router.post('/auth/logout', rateLimit(deps, 'logout-ip', RATE_LIMITS.logoutPerIp), asyncHandler(signOut(deps)));
  router.post('/auth/password-reset', rateLimit(deps, 'password-reset-ip', RATE_LIMITS.passwordResetPerIp), asyncHandler(passwordReset(deps)));

  router.post(
    '/auth/verify-email/resend',
    requireAuth(deps),
    rateLimit(deps, 'verify-email-resend-user', { ...RATE_LIMITS.verificationEmailsPerUser, key: userKey }),
    asyncHandler(resendVerification(deps)),
  );
  // Pages opened from the emails, per IP; over the limit they answer an HTML page.
  const pageLimit = (name: string, rule: RateLimitRule = RATE_LIMITS.emailLinkPagesPerIp) =>
    rateLimit(deps, name, { ...rule, onRefused: tooManyRequestsPage });
  router.get('/auth/verify-email', pageLimit('verify-email-page-ip'), verifyEmailPage(deps));
  router.post('/auth/verify-email', pageLimit('verify-email-submit-ip'), verifyEmailFormSubmit(deps));
  router.get('/auth/reset-password', pageLimit('reset-password-page-ip'), resetPasswordPage(deps));
  const submitForm = resetPasswordFormSubmit(deps);
  const submitJson = asyncHandler(resetPasswordJson(deps));
  router.post(
    '/auth/reset-password',
    // Every submission hashes a password (argon2): limited like sign-in.
    pageLimit('reset-password-ip', RATE_LIMITS.loginPerIp),
    (req: Request, res: Response, next: NextFunction) =>
      req.is('application/x-www-form-urlencoded') ? submitForm(req, res, next) : submitJson(req, res, next),
  );
  return router;
}
