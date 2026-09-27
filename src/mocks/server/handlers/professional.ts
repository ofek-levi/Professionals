/** `/professional/*` routes (dashboard, job explorer, own profile). */
import { CATEGORY_IDS } from '@/constants/professional-categories';
import { URGENCY_LEVELS } from '@/constants/urgency-levels';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import { updateProfessionalProfileSchema } from '@/lib/validation/profile';
import { NEARBY_REQUEST_SORTS, OFFER_PRESENCE_FILTERS, type NearbyRequestsParams } from '@/types/api';
import type { OwnProfessionalProfile } from '@/types/domain';
import { isValidDateKey } from '@/utils/dates';

import type { ProfessionalActor } from '../auth';
import type { ServerContext } from '../context';
import { paginate } from '../pagination';
import { requireProfessional } from '../queries';
import { route, type QueryReader } from '../router';
import { getProfessionalDashboard } from '../services/dashboard-service';
import { findNearbyRequests } from '../services/matching-service';
import { emitProfileUpdated } from '../services/notification-service';
import { parseBody } from '../validate';
import { toProfessionalRequestView } from '../views';
import { paginationFrom } from './shared';

function dateKeyParam(query: QueryReader, key: string): string | undefined {
  const value = query.string(key);
  if (value !== undefined && !isValidDateKey(value)) throw DomainError.validation({ [key]: [vm('invalid')] });
  return value;
}

function nearbyParams(query: QueryReader): NearbyRequestsParams {
  const maxDistanceKm = query.number('maxDistanceKm');
  if (maxDistanceKm !== undefined && maxDistanceKm <= 0) throw DomainError.validation({ maxDistanceKm: [vm('invalid')] });
  return {
    categoryIds: query.enumList('categoryIds', CATEGORY_IDS),
    maxDistanceKm,
    urgencies: query.enumList('urgencies', URGENCY_LEVELS),
    preferredDateFrom: dateKeyParam(query, 'preferredDateFrom'),
    preferredDateTo: dateKeyParam(query, 'preferredDateTo'),
    offerPresence: query.enumValue('offerPresence', OFFER_PRESENCE_FILTERS),
    excludeWithMyOffer: query.boolean('excludeWithMyOffer'),
    sort: query.enumValue('sort', NEARBY_REQUEST_SORTS),
  };
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName: firstName ?? '', lastName: rest.join(' ') };
}

function updateOwnProfile(ctx: ServerContext, actor: ProfessionalActor, body: unknown): OwnProfessionalProfile {
  const payload = parseBody(updateProfessionalProfileSchema, body);
  const current = requireProfessional(ctx.db, actor.professional.id);
  const now = ctx.nowIso();
  const updated = ctx.db.professionals.update(current.id, {
    ...(payload.fullName !== undefined ? { fullName: payload.fullName } : {}),
    ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
    ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
    ...(payload.headline !== undefined ? { headline: payload.headline } : {}),
    ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
    ...(payload.categoryIds !== undefined ? { categoryIds: [...new Set(payload.categoryIds)] } : {}),
    ...(payload.yearsOfExperience !== undefined ? { yearsOfExperience: payload.yearsOfExperience } : {}),
    ...(payload.serviceArea !== undefined ? { serviceArea: payload.serviceArea } : {}),
    ...(payload.baseLocation !== undefined
      ? { baseLocation: payload.baseLocation ? { ...payload.baseLocation, isApproximate: false } : null }
      : {}),
    ...(payload.availability !== undefined ? { availability: payload.availability } : {}),
    ...(payload.contact !== undefined ? { contact: payload.contact } : {}),
    ...(payload.business !== undefined ? { business: payload.business } : {}),
    ...(payload.startingPrice !== undefined ? { startingPrice: payload.startingPrice } : {}),
    ...(payload.notificationPreferences !== undefined ? { notificationPreferences: payload.notificationPreferences } : {}),
    updatedAt: now,
  });
  // Keep the account in sync with the public profile.
  ctx.db.users.update(actor.userId, {
    ...splitFullName(updated.fullName),
    displayName: updated.displayName,
    avatarUrl: updated.avatarUrl,
    phone: updated.contact.phone,
    email: updated.contact.email,
  });
  emitProfileUpdated(ctx, updated.id);
  return updated;
}

export const professionalRoutes = [
  route({
    method: 'GET',
    path: '/professional/dashboard',
    auth: 'professional',
    handler: ({ ctx, actor }) => getProfessionalDashboard(ctx, actor),
  }),
  route({
    method: 'GET',
    path: '/professional/requests/nearby',
    auth: 'professional',
    handler: ({ ctx, actor, query }) => {
      const professional = requireProfessional(ctx.db, actor.professional.id);
      const page = paginate(findNearbyRequests(ctx, professional, nearbyParams(query)), paginationFrom(query));
      return { ...page, items: page.items.map((request) => toProfessionalRequestView(ctx, request, professional)) };
    },
  }),
  route({
    method: 'GET',
    path: '/professional/profile',
    auth: 'professional',
    handler: ({ ctx, actor }) => requireProfessional(ctx.db, actor.professional.id),
  }),
  route({
    method: 'PATCH',
    path: '/professional/profile',
    auth: 'professional',
    handler: ({ ctx, actor, body }) => updateOwnProfile(ctx, actor, body),
  }),
];
