/**
 * Matching between service requests and professionals, and the professional job-explorer
 * filters/sorting. The mock backend uses exactly these functions for
 * `GET /professional/requests/nearby`, so the filter UI and the server always agree.
 */
import { compareUrgency } from '@/constants/urgency-levels';
import { hashString } from '@/features/shared/seeded-random';
import type { NearbyRequestSort, NearbyRequestsParams } from '@/types/api';
import type { GeoCoordinates, ProfessionalProfile, ServiceArea, ServiceLocation, ServiceRequest } from '@/types/domain';
import { haversineDistanceKm, offsetCoordinates, roundDistanceKm } from '@/utils/geo';

import { requestAcceptsOffers } from './request-status-machine';

/** The parts of a professional profile that matching depends on. */
export type MatchableProfessional = Pick<ProfessionalProfile, 'categoryIds' | 'serviceArea'>;

type MatchableRequest = Pick<ServiceRequest, 'status' | 'categoryId' | 'location'>;

export type WithDistance<T> = T & { distanceKm: number };

/** Approximate locations are moved by a deterministic 250–450 m offset. */
export const APPROXIMATE_LOCATION_MIN_OFFSET_M = 250;
export const APPROXIMATE_LOCATION_MAX_OFFSET_M = 450;

export function isRequestOpenForOffers(request: Pick<ServiceRequest, 'status'>): boolean {
  return requestAcceptsOffers(request.status);
}

export function professionalCoversCategory(pro: Pick<ProfessionalProfile, 'categoryIds'>, categoryId: string): boolean {
  return (pro.categoryIds as readonly string[]).includes(categoryId);
}

export function isWithinServiceArea(area: ServiceArea, coords: GeoCoordinates): boolean {
  return haversineDistanceKm(area.center, coords) <= area.radiusKm;
}

/** Distance (0.1 km precision) from the professional's service-area center to a point. */
export function distanceFromServiceAreaKm(area: ServiceArea, coords: GeoCoordinates): number {
  return roundDistanceKm(haversineDistanceKm(area.center, coords));
}

/** Category and service area match, regardless of the request status. */
export function isRequestMatchForProfessional(request: MatchableRequest, pro: MatchableProfessional): boolean {
  return (
    professionalCoversCategory(pro, request.categoryId) && isWithinServiceArea(pro.serviceArea, request.location.coordinates)
  );
}

/** A request is delivered to a professional when it accepts offers and matches category + area. */
export function isRequestVisibleToProfessional(request: MatchableRequest, pro: MatchableProfessional): boolean {
  return isRequestOpenForOffers(request) && isRequestMatchForProfessional(request, pro);
}

export interface NearbyFilterContext {
  /** Requests on which the professional already has an active (pending/accepted) offer. */
  myActiveOfferRequestIds?: ReadonlySet<string>;
}

/** True when any narrowing filter (besides sorting/pagination) is set. */
export function hasActiveNearbyFilters(params: NearbyRequestsParams): boolean {
  return Boolean(
    (params.categoryIds && params.categoryIds.length > 0) ||
      params.maxDistanceKm !== undefined ||
      (params.urgencies && params.urgencies.length > 0) ||
      params.preferredDateFrom ||
      params.preferredDateTo ||
      (params.offerPresence && params.offerPresence !== 'any') ||
      params.excludeWithMyOffer,
  );
}

/**
 * Open requests visible to `pro` that satisfy the explorer filters, with `distanceKm` measured from
 * the service-area center to the real request location. The result is not sorted.
 */
export function filterNearbyRequests<T extends ServiceRequest>(
  requests: readonly T[],
  pro: MatchableProfessional,
  params: NearbyRequestsParams = {},
  ctx: NearbyFilterContext = {},
): WithDistance<T>[] {
  const ownCategories = new Set<string>(pro.categoryIds);
  const requestedCategories =
    params.categoryIds && params.categoryIds.length > 0
      ? new Set<string>(params.categoryIds.filter((id) => ownCategories.has(id)))
      : ownCategories;
  const maxDistanceKm =
    params.maxDistanceKm !== undefined && params.maxDistanceKm > 0
      ? Math.min(params.maxDistanceKm, pro.serviceArea.radiusKm)
      : pro.serviceArea.radiusKm;
  const urgencies = params.urgencies && params.urgencies.length > 0 ? new Set(params.urgencies) : null;
  const hasDateFilter = Boolean(params.preferredDateFrom || params.preferredDateTo);
  const offerPresence = params.offerPresence ?? 'any';
  const excluded = params.excludeWithMyOffer ? (ctx.myActiveOfferRequestIds ?? new Set<string>()) : null;

  const result: WithDistance<T>[] = [];
  for (const request of requests) {
    if (!isRequestOpenForOffers(request)) continue;
    if (!requestedCategories.has(request.categoryId)) continue;
    if (urgencies && !urgencies.has(request.urgency)) continue;
    // Competition = live offers; expired or rejected ones no longer compete.
    if (offerPresence === 'no_offers' && request.pendingOfferCount !== 0) continue;
    if (offerPresence === 'has_offers' && request.pendingOfferCount === 0) continue;
    if (excluded?.has(request.id)) continue;
    if (hasDateFilter) {
      const date = request.preferredSchedule?.date;
      if (!date) continue;
      if (params.preferredDateFrom && date < params.preferredDateFrom) continue;
      if (params.preferredDateTo && date > params.preferredDateTo) continue;
    }
    const exactDistance = haversineDistanceKm(pro.serviceArea.center, request.location.coordinates);
    if (exactDistance > maxDistanceKm) continue;
    result.push({ ...request, distanceKm: roundDistanceKm(exactDistance) });
  }
  return result;
}

const recency = (request: ServiceRequest) => Date.parse(request.publishedAt ?? request.createdAt);

/** Sorts explorer results; ties fall back to newest first, then id for stable ordering. */
export function sortNearbyRequests<T extends WithDistance<ServiceRequest>>(
  list: readonly T[],
  sort: NearbyRequestSort = 'newest',
): T[] {
  const newestFirst = (a: T, b: T) => recency(b) - recency(a) || a.id.localeCompare(b.id);
  const comparators: Record<NearbyRequestSort, (a: T, b: T) => number> = {
    newest: newestFirst,
    nearest: (a, b) => a.distanceKm - b.distanceKm || newestFirst(a, b),
    most_urgent: (a, b) => compareUrgency(a.urgency, b.urgency) || newestFirst(a, b),
    fewest_offers: (a, b) => a.pendingOfferCount - b.pendingOfferCount || newestFirst(a, b),
  };
  return [...list].sort(comparators[sort]);
}

/**
 * Privacy-preserving version of a location shown to professionals before they are hired:
 * coordinates moved by a deterministic 250–450 m offset derived from `seed` (e.g. the request id,
 * so every professional sees the same approximate pin), no street address and no details.
 */
export function approximateLocation(location: ServiceLocation, seed: string): ServiceLocation {
  const hash = hashString(seed);
  const span = APPROXIMATE_LOCATION_MAX_OFFSET_M - APPROXIMATE_LOCATION_MIN_OFFSET_M;
  const meters = APPROXIMATE_LOCATION_MIN_OFFSET_M + (hash % (span + 1));
  const bearing = hashString(`${seed}:bearing`) % 360;
  return {
    coordinates: offsetCoordinates(location.coordinates, meters, bearing),
    addressLine: '',
    city: location.city,
    neighborhood: location.neighborhood,
    details: null,
    isApproximate: true,
  };
}
