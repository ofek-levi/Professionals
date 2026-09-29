/** `/auth/*` and `/me` routes. */
import { DomainError } from '@/features/shared/domain-error';
import { demoLoginSchema, registerDeviceSchema } from '@/lib/validation/auth';
import type { AuthSession, CurrentUserResponse } from '@/types/api';
import type { DemoAccount } from '@/types/domain';

import { createAccessToken, type Actor } from '../auth';
import type { ServerContext } from '../context';
import { requireProfessional } from '../queries';
import { route } from '../router';
import { login, register, requestPasswordReset, signInWithGoogle } from '../services/account-service';
import { parseBody } from '../validate';
import { professionalCity, toUser } from '../views';
import { SUCCESS } from './shared';

function listDemoAccounts(ctx: ServerContext): DemoAccount[] {
  const accounts = ctx.db.users
    .filter((user) => user.isDemo)
    .map((user): DemoAccount => {
      if (user.role === 'customer') {
        return {
          userId: user.id,
          role: 'customer',
          displayName: `${user.firstName} ${user.lastName}`,
          avatarUrl: user.avatarUrl,
          description: user.demoDescription ?? { en: '', he: '' },
          categoryIds: [],
          city: ctx.db.customerProfiles.get(user.id)?.defaultLocation?.city ?? '',
        };
      }
      const professional = ctx.db.professionals.find((profile) => profile.userId === user.id);
      return {
        userId: user.id,
        role: 'professional',
        displayName: professional?.fullName ?? user.displayName,
        avatarUrl: user.avatarUrl,
        description: user.demoDescription ?? { en: '', he: '' },
        categoryIds: professional ? [...professional.categoryIds] : [],
        city: professional ? professionalCity(professional) : '',
      };
    });
  // Customers first, then professionals, each in seed order.
  return [...accounts.filter((account) => account.role === 'customer'), ...accounts.filter((account) => account.role === 'professional')];
}

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

export const authRoutes = [
  route({ method: 'GET', path: '/auth/demo-accounts', auth: 'public', handler: ({ ctx }) => listDemoAccounts(ctx) }),
  route({
    method: 'POST',
    path: '/auth/demo-login',
    auth: 'public',
    handler: ({ ctx, body }): AuthSession => {
      const { userId } = parseBody(demoLoginSchema, body);
      const user = ctx.db.users.get(userId);
      if (!user?.isDemo) throw DomainError.notFound('Demo account', userId);
      return { accessToken: createAccessToken(user.id), user: toUser(user) };
    },
  }),
  route({ method: 'POST', path: '/auth/login', auth: 'public', handler: ({ ctx, body }) => login(ctx, body) }),
  route({ method: 'POST', path: '/auth/register', auth: 'public', handler: ({ ctx, body }) => register(ctx, body) }),
  route({ method: 'POST', path: '/auth/google', auth: 'public', handler: ({ ctx, body }) => signInWithGoogle(ctx, body) }),
  route({
    method: 'POST',
    path: '/auth/password-reset',
    auth: 'public',
    handler: ({ ctx, body }) => requestPasswordReset(ctx, body),
  }),
  // Logging out always succeeds, even with an expired token.
  route({ method: 'POST', path: '/auth/logout', auth: 'public', handler: () => SUCCESS }),
  route({ method: 'GET', path: '/me', auth: 'user', handler: ({ ctx, actor }) => currentUser(ctx, actor) }),
  route({
    method: 'POST',
    path: '/me/devices',
    auth: 'user',
    handler: ({ ctx, actor, body }) => {
      const payload = parseBody(registerDeviceSchema, body);
      const existing = ctx.db.devices.find((device) => device.pushToken === payload.pushToken);
      if (existing) {
        ctx.db.devices.update(existing.id, { userId: actor.userId, platform: payload.platform, registeredAt: ctx.nowIso() });
      } else {
        ctx.db.devices.insert({
          id: ctx.newId('dev'),
          userId: actor.userId,
          pushToken: payload.pushToken,
          platform: payload.platform,
          registeredAt: ctx.nowIso(),
        });
      }
      return SUCCESS;
    },
  }),
];
