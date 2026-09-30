/** `/auth/*` and `/me` routes (backend/docs/API.md → Auth, Users). */
import { z } from 'zod';

import { vm } from '@/lib/validation/messages';
import type { CurrentUserResponse } from '@/types/api';
import { SUPPORTED_LANGUAGES } from '@/types/domain';

import { readBearerToken, type Actor } from '../auth';
import type { ServerContext } from '../context';
import { requireProfessional } from '../queries';
import { created, route } from '../router';
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
  if (actor.role === 'customer') {
    return {
      user: { ...user, role: 'customer' },
      customerProfile: ctx.db.customerProfiles.require(actor.userId, 'Customer profile'),
      professionalProfile: null,
    };
  }
  return {
    user: { ...user, role: 'professional' },
    customerProfile: null,
    professionalProfile: requireProfessional(ctx.db, actor.professional.id),
  };
}

/** Upserts the token for the caller's session: a token of another account moves to the caller. */
function registerDevice(ctx: ServerContext, actor: Actor, body: unknown) {
  const { pushToken, platform } = parseBody(registerDeviceSchema, body);
  const existing = ctx.db.devices.find((device) => device.pushToken === pushToken);
  const fields = { userId: actor.userId, sessionId: actor.sessionId, platform, registeredAt: ctx.nowIso() };
  if (existing) ctx.db.devices.update(existing.id, fields);
  else ctx.db.devices.insert({ id: ctx.newId('dev'), pushToken, ...fields });
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
  route({ method: 'POST', path: '/me/devices', auth: 'user', handler: ({ ctx, actor, body }) => registerDevice(ctx, actor, body) }),
  route({
    method: 'DELETE',
    path: '/me/devices/:token',
    auth: 'user',
    handler: ({ ctx, actor, params }) => {
      const device = ctx.db.devices.find((row) => row.pushToken === params.token && row.userId === actor.userId);
      if (device) ctx.db.devices.delete(device.id);
      return SUCCESS;
    },
  }),
];
