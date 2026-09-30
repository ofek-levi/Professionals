/** JSON endpoints of `/auth/*` (thin: validate → service). */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { validateRequest } from '../../lib/validate.js';
import { bearerClaims } from '../../middleware/auth.js';
import { clientIpKey } from '../../middleware/rate-limit.js';
import type { SuccessResponse } from '../../shared/contract/index.js';
import { googleBody, loginBody, logoutBody, passwordResetBody, refreshBody, registerBody, resetPasswordBody } from './auth.schemas.js';
import { signInWithGoogle } from './google-auth.service.js';
import { login } from './login.service.js';
import { requestPasswordReset, resetPassword } from './password-reset.service.js';
import { register } from './register.service.js';
import { logout, refreshSession } from './session.service.js';

const SUCCESS: SuccessResponse = { success: true };

export const registerAccount = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: registerBody });
  return register(deps, body);
};

export const signInWithPassword = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: loginBody });
  return login(deps, body, clientIpKey(req));
};

export const signInGoogle = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: googleBody });
  return signInWithGoogle(deps, body.idToken);
};

export const refresh = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: refreshBody });
  return refreshSession(deps, body.refreshToken);
};

/** Always succeeds: the app signs out locally anyway, even with an expired token. */
export const signOut = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: logoutBody });
  await logout(deps, { refreshToken: body.refreshToken, bearerSessionId: bearerClaims(deps, req)?.sessionId ?? null });
  return SUCCESS;
};

export const passwordReset = (deps: AppDeps) => (req: Request) => {
  const { body } = validateRequest(req, { body: passwordResetBody });
  requestPasswordReset(deps, body.email);
  return SUCCESS;
};

/** `POST /auth/reset-password` as JSON (the HTML form is handled by `auth-pages.controller`). */
export const resetPasswordJson = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: resetPasswordBody });
  await resetPassword(deps, body);
  return SUCCESS;
};
