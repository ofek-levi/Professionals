/** `/auth/*` and `/me` routes, account deletion included (backend/docs/API.md → Auth, Users). */
import { z } from 'zod';

import { vm } from '@/lib/validation/messages';
import type { CurrentUserResponse } from '@/types/api';
import { SUPPORTED_LANGUAGES } from '@/types/domain';

import { readBearerToken, type Actor } from '../auth';
import { removeAvatar, setAvatar } from '../avatars';
import type { ServerContext } from '../context';
import { requireProfessional } from '../queries';
import { created, route } from '../router';
import { deleteAccount, getDeletionImpact } from '../services/account-deletion-service';
import { login, register, requestPasswordReset, signInWithGoogle } from '../services/account-service';
import { logout, refreshSession } from '../sessions';
import { parseBody } from '../validate';
import { toUser } from '../views';
import { SUCCESS } from './shared';

const refreshSchema = z.object({
  refreshToken: z.string({ error: vm('required') }).min(1, vm('required')),
});

const logoutSchema = z.object({ refreshToken: z.string().optional() });

const updateMeSchema = z.object({
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES, { error: vm('invalid') }),
});

/** Expo push tokens only (`ExponentPushToken[…]`), like the backend's push provider check. */
const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[.+\]$/;

const registerDeviceSchema = z.object({
  pushToken: z
    .string({ error: vm('required') })
    .trim()
    .min(1, vm('required'))
    .max(200, vm('invalid'))
    .regex(EXPO_PUSH_TOKEN, vm('invalid')),
  platform: z.enum(['ios', 'android', 'web'], { error: vm('invalid') }),
});

function currentUser(ctx: ServerContext, actor: Actor): CurrentUserResponse {
  const user = toUser(ctx.db.users.require(actor.userId, 'User'));
  const emailVerified = ctx.db.credentials.find((credential) => credential.userId === actor.userId)?.emailVerified ?? false;
  if (actor.role === 'customer') {
    return {
      user: { ...user, role: 'customer' },
      emailVerified,
      customerProfile: ctx.db.customerProfiles.require(actor.userId, 'Customer profile'),
      professionalProfile: null,
    };
  }
  return {
    user: { ...user, role: 'professional' },
    emailVerified,
    customerProfile: null,
    professionalProfile: requireProfessional(ctx.db, actor.professional.id),
  };
}

/**
 * Stores the token on the caller's session (the platform is validated, not stored). A session has
 * one token, so a new one replaces the old; a token held by another session (another account on
 * the same phone) moves to the caller.
 */
function registerDevice(ctx: ServerContext, actor: Actor, body: unknown) {
  const { pushToken } = parseBody(registerDeviceSchema, body);
  ctx.db.sessions
    .filter((session) => session.pushToken === pushToken && session.id !== actor.sessionId)
    .forEach((session) => ctx.db.sessions.update(session.id, { pushToken: null }));
  ctx.db.sessions.update(actor.sessionId, { pushToken });
  return SUCCESS;
}

/** Removes the token from the caller's own sessions (idempotent; another account's is untouched). */
function unregisterDevice(ctx: ServerContext, actor: Actor, pushToken: string) {
  ctx.db.sessions
    .filter((session) => session.pushToken === pushToken && session.userId === actor.userId)
    .forEach((session) => ctx.db.sessions.update(session.id, { pushToken: null }));
  return SUCCESS;
}

export const authRoutes = [
  route({ method: 'POST', path: '/auth/login', auth: 'public', handler: ({ ctx, body }) => login(ctx, body) }),
  route({ method: 'POST', path: '/auth/register', auth: 'public', handler: ({ ctx, body }) => created(register(ctx, body)) }),
  route({ method: 'POST', path: '/auth/google', auth: 'public', handler: ({ ctx, body }) => signInWithGoogle(ctx, body) }),
  route({
    method: 'POST',
    path: '/auth/refresh',
    auth: 'public',
    handler: ({ ctx, body }) => refreshSession(ctx, parseBody(refreshSchema, body).refreshToken),
  }),
  route({
    method: 'POST',
    path: '/auth/password-reset',
    auth: 'public',
    handler: ({ ctx, body }) => requestPasswordReset(ctx, body),
  }),
  // Always succeeds (idempotent, also with an expired token).
  route({
    method: 'POST',
    path: '/auth/logout',
    auth: 'public',
    handler: ({ ctx, body, headers }) => logout(ctx, logoutSchema.safeParse(body ?? {}).data?.refreshToken, readBearerToken(headers)),
  }),
  route({ method: 'GET', path: '/me', auth: 'user', handler: ({ ctx, actor }) => currentUser(ctx, actor) }),
  // The double sends no email: a resend only records that one was asked for.
  route({
    method: 'POST',
    path: '/auth/verify-email/resend',
    auth: 'user',
    handler: ({ ctx, actor }) => {
      ctx.db.users.require(actor.userId, 'User');
      return SUCCESS;
    },
  }),
  route({
    method: 'PATCH',
    path: '/me',
    auth: 'user',
    handler: ({ ctx, actor, body }) => {
      const { preferredLanguage } = parseBody(updateMeSchema, body);
      ctx.db.users.update(actor.userId, { preferredLanguage });
      return currentUser(ctx, actor);
    },
  }),
  route({
    method: 'PUT',
    path: '/me/avatar',
    auth: 'user',
    handler: ({ ctx, actor, body }) => {
      setAvatar(ctx, actor, body);
      return currentUser(ctx, actor);
    },
  }),
  route({
    method: 'DELETE',
    path: '/me/avatar',
    auth: 'user',
    handler: ({ ctx, actor }) => {
      removeAvatar(ctx, actor);
      return currentUser(ctx, actor);
    },
  }),
  route({ method: 'POST', path: '/me/devices', auth: 'user', handler: ({ ctx, actor, body }) => registerDevice(ctx, actor, body) }),
  route({ method: 'DELETE', path: '/me/devices/:token', auth: 'user', handler: ({ ctx, actor, params }) => unregisterDevice(ctx, actor, params.token) }),
  route({ method: 'GET', path: '/me/deletion-impact', auth: 'user', handler: ({ ctx, actor }) => getDeletionImpact(ctx, actor) }),
  route({ method: 'POST', path: '/me/deletion', auth: 'user', handler: ({ ctx, actor, body }) => deleteAccount(ctx, actor, body) }),
];
