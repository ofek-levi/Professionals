/**
 * `/auth/*`: public endpoints (no `requireAuth`), each with per-IP and, where an address is
 * involved, per-email rate limits (Redis). The reset form posts URL-encoded data and gets HTML
 * back; the same path accepts JSON for API clients.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { emailKey, RATE_LIMITS, rateLimit } from '../../middleware/rate-limit.js';
import { passwordReset, refresh, registerAccount, resetPasswordJson, signInGoogle, signInWithPassword, signOut } from './auth.controller.js';
import { resetPasswordFormSubmit, resetPasswordPage, verifyEmailPage } from './auth-pages.controller.js';

export function createAuthRouter(deps: AppDeps): Router {
  const router = Router();
  const perEmail = (name: string, rule: { windowMs: number; limit: number }) => rateLimit(deps, name, { ...rule, key: emailKey });

  router.post(
    '/auth/register',
    rateLimit(deps, 'register-ip', RATE_LIMITS.registerPerIp),
    perEmail('register-email', RATE_LIMITS.registerPerEmail),
    asyncHandler(registerAccount(deps), { status: 201 }),
  );
  router.post(
    '/auth/login',
    rateLimit(deps, 'login-ip', RATE_LIMITS.loginPerIp),
    perEmail('login-email', RATE_LIMITS.loginPerEmail),
    asyncHandler(signInWithPassword(deps)),
  );
  router.post('/auth/google', rateLimit(deps, 'google-ip', RATE_LIMITS.googlePerIp), asyncHandler(signInGoogle(deps)));
  router.post('/auth/refresh', rateLimit(deps, 'refresh-ip', RATE_LIMITS.refreshPerIp), asyncHandler(refresh(deps)));
  router.post('/auth/logout', asyncHandler(signOut(deps)));
  router.post(
    '/auth/password-reset',
    rateLimit(deps, 'password-reset-ip', RATE_LIMITS.passwordResetPerIp),
    perEmail('password-reset-email', RATE_LIMITS.passwordResetPerEmail),
    asyncHandler(passwordReset(deps)),
  );

  router.get('/auth/verify-email', verifyEmailPage(deps));
  router.get('/auth/reset-password', resetPasswordPage(deps));
  const submitForm = resetPasswordFormSubmit(deps);
  const submitJson = asyncHandler(resetPasswordJson(deps));
  router.post(
    '/auth/reset-password',
    // Every submission hashes a password (argon2): limited like sign-in.
    rateLimit(deps, 'reset-password-ip', RATE_LIMITS.loginPerIp),
    (req: Request, res: Response, next: NextFunction) =>
      req.is('application/x-www-form-urlencoded') ? submitForm(req, res, next) : submitJson(req, res, next),
  );
  return router;
}
