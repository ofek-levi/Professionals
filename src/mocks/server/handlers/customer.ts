/** `/customer/*` routes. */
import { REQUEST_STATUSES, CUSTOMER_REQUEST_SECTIONS } from '@/constants/request-statuses';
import { getCustomerRequestSection } from '@/features/requests/request-status-machine';
import { updateCustomerProfileSchema } from '@/lib/validation/profile';
import type { CustomerProfile, ServiceLocation, User } from '@/types/domain';

import type { CustomerActor } from '../auth';
import type { ServerContext } from '../context';
import { paginate } from '../pagination';
import { route } from '../router';
import { getCustomerDashboard } from '../services/dashboard-service';
import { parseBody } from '../validate';
import { toCustomerRequestView, toUser } from '../views';
import { paginationFrom } from './shared';

function customerProfileResponse(ctx: ServerContext, userId: string): { user: User; profile: CustomerProfile } {
  return {
    user: toUser(ctx.db.users.require(userId, 'User')),
    profile: ctx.db.customerProfiles.require(userId, 'Customer profile'),
  };
}

function updateCustomerProfile(ctx: ServerContext, actor: CustomerActor, body: unknown) {
  const payload = parseBody(updateCustomerProfileSchema, body);
  const now = ctx.nowIso();
  const user = ctx.db.users.require(actor.userId, 'User');
  const firstName = payload.firstName ?? user.firstName;
  const lastName = payload.lastName ?? user.lastName;
  ctx.db.users.update(user.id, {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
    ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
  });
  const profile = ctx.db.customerProfiles.require(actor.userId, 'Customer profile');
  const defaultLocation: ServiceLocation | null | undefined =
    payload.defaultLocation === undefined
      ? undefined
      : payload.defaultLocation === null
        ? null
        : { ...payload.defaultLocation, isApproximate: false };
  ctx.db.customerProfiles.update(actor.userId, {
    ...(defaultLocation !== undefined
      ? {
          defaultLocation,
          savedLocations: [
            ...(defaultLocation ? [{ id: `loc_${actor.userId}_home`, label: 'Home', location: defaultLocation }] : []),
            ...profile.savedLocations.filter((saved) => saved.id !== `loc_${actor.userId}_home`),
          ],
        }
      : {}),
    ...(payload.notificationPreferences !== undefined ? { notificationPreferences: payload.notificationPreferences } : {}),
    updatedAt: now,
  });
  return customerProfileResponse(ctx, actor.userId);
}

export const customerRoutes = [
  route({ method: 'GET', path: '/customer/dashboard', auth: 'customer', handler: ({ ctx, actor }) => getCustomerDashboard(ctx, actor) }),
  route({
    method: 'GET',
    path: '/customer/requests',
    auth: 'customer',
    handler: ({ ctx, actor, query }) => {
      const section = query.enumValue('section', CUSTOMER_REQUEST_SECTIONS);
      const statuses = query.enumList('statuses', REQUEST_STATUSES);
      const requests = ctx.db.requests
        .filter(
          (request) =>
            request.customerId === actor.userId &&
            (!section || getCustomerRequestSection(request) === section) &&
            (!statuses || statuses.includes(request.status)),
        )
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id.localeCompare(a.id));
      const page = paginate(requests, paginationFrom(query));
      return { ...page, items: page.items.map((request) => toCustomerRequestView(ctx, request)) };
    },
  }),
  route({ method: 'GET', path: '/customer/profile', auth: 'customer', handler: ({ ctx, actor }) => customerProfileResponse(ctx, actor.userId) }),
  route({
    method: 'PATCH',
    path: '/customer/profile',
    auth: 'customer',
    handler: ({ ctx, actor, body }) => updateCustomerProfile(ctx, actor, body),
  }),
];
