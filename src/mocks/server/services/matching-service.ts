/**
 * Who sees which requests: delivery of new requests to matching professionals and the
 * professional job explorer (`GET /professional/requests/nearby`).
 */
import {
  distanceFromServiceAreaKm,
  filterNearbyRequests,
  isRequestMatchForProfessional,
  sortNearbyRequests,
  type WithDistance,
} from '@/features/requests/request-matching';
import type { NearbyRequestsParams } from '@/types/api';
import type { OwnProfessionalProfile, ServiceRequest } from '@/types/domain';

import type { ServerContext } from '../context';
import { activeOfferRequestIds } from '../queries';

export interface ProfessionalMatch {
  professional: OwnProfessionalProfile;
  distanceKm: number;
}

/** Professionals whose categories and service area match the request, nearest first. */
export function findMatchingProfessionals(ctx: ServerContext, request: ServiceRequest): ProfessionalMatch[] {
  return ctx.db.professionals
    .filter((professional) => isRequestMatchForProfessional(request, professional))
    .map((professional) => ({
      professional,
      distanceKm: distanceFromServiceAreaKm(professional.serviceArea, request.location.coordinates),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.professional.id.localeCompare(b.professional.id));
}

/** Open, matching requests for the explorer, filtered and sorted with the shared rules. */
export function findNearbyRequests(
  ctx: ServerContext,
  professional: OwnProfessionalProfile,
  params: NearbyRequestsParams = {},
): WithDistance<ServiceRequest>[] {
  const visible = filterNearbyRequests(ctx.db.requests.all(), professional, params, {
    myActiveOfferRequestIds: activeOfferRequestIds(ctx.db, professional.id),
  });
  return sortNearbyRequests(visible, params.sort ?? 'newest');
}
