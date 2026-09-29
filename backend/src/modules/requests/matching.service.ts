/**
 * Matching between requests and professionals (the app's `features/requests/request-matching.ts`):
 * the professional covers the request's category and the request lies within their service radius
 * (haversine from the service-area center).
 */
import type { ClientSession, Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { fromGeoPoint, haversineDistanceKm, roundDistanceKm } from '../../lib/geo.js';
import { geoNearStage } from '../../lib/geo-near.js';
import type { GeoCoordinates } from '../../shared/contract/index.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { requestAcceptsOffers } from '../../shared/statuses.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import type { RequestDoc } from './request.model.js';

/** The parts of a professional that matching depends on. */
export type MatchableProfessional = Pick<ProfessionalDoc, '_id' | 'categoryIds' | 'serviceArea'>;
export const MATCHABLE_PROJECTION = { categoryIds: 1, serviceArea: 1 } as const;

type MatchableRequest = Pick<RequestDoc, 'categoryId' | 'location'>;

/** The caller's matching profile (a professional account always has one). */
export async function loadMatchableProfessional(professionalId: Types.ObjectId): Promise<MatchableProfessional> {
  const professional = await ProfessionalModel.findById(professionalId, MATCHABLE_PROJECTION).lean<MatchableProfessional>();
  if (!professional) throw ApiError.notFound('Professional');
  return professional;
}

export function serviceAreaCenter(professional: Pick<ProfessionalDoc, 'serviceArea'>): GeoCoordinates {
  return fromGeoPoint(professional.serviceArea.center);
}

export function requestCoordinates(request: Pick<RequestDoc, 'location'>): GeoCoordinates {
  return fromGeoPoint(request.location.point);
}

/** Exact distance (km) from the service-area center to the request. */
export function exactDistanceKm(professional: Pick<ProfessionalDoc, 'serviceArea'>, request: Pick<RequestDoc, 'location'>): number {
  return haversineDistanceKm(serviceAreaCenter(professional), requestCoordinates(request));
}

/** The distance the app shows (0.1 km precision). */
export function distanceKm(professional: Pick<ProfessionalDoc, 'serviceArea'>, request: Pick<RequestDoc, 'location'>): number {
  return roundDistanceKm(exactDistanceKm(professional, request));
}

export function coversCategory(professional: Pick<ProfessionalDoc, 'categoryIds'>, categoryId: string): boolean {
  return (professional.categoryIds as readonly string[]).includes(categoryId);
}

export function isWithinServiceArea(professional: Pick<ProfessionalDoc, 'serviceArea'>, request: Pick<RequestDoc, 'location'>): boolean {
  return exactDistanceKm(professional, request) <= professional.serviceArea.radiusKm;
}

/** Category and service area match, regardless of the request status. */
export function isRequestMatch(request: MatchableRequest, professional: MatchableProfessional): boolean {
  return coversCategory(professional, request.categoryId) && isWithinServiceArea(professional, request);
}

export interface ProfessionalMatch {
  professionalId: Types.ObjectId;
  distanceKm: number;
}

/**
 * Professionals whose categories and service area cover the request, nearest first: `$geoNear`
 * from the request over service-area centers (bounded by the largest radius the app allows), then
 * each professional's own radius.
 */
export async function findMatchingProfessionals(request: MatchableRequest, session?: ClientSession): Promise<ProfessionalMatch[]> {
  const rows = await ProfessionalModel.aggregate<{ _id: Types.ObjectId; distanceKm: number }>([
    geoNearStage({
      near: requestCoordinates(request),
      key: 'serviceArea.center',
      distanceField: 'distanceKm',
      maxDistanceKm: APP_CONFIG.maxServiceRadiusKm,
      query: { categoryIds: request.categoryId },
    }),
    { $match: { $expr: { $lte: ['$distanceKm', '$serviceArea.radiusKm'] } } },
    { $sort: { distanceKm: 1, _id: 1 } },
    { $project: { _id: 1, distanceKm: 1 } },
  ]).session(session ?? null);
  return rows.map((row) => ({ professionalId: row._id, distanceKm: roundDistanceKm(row.distanceKm) }));
}

/**
 * Professionals whose explorer (map, list, dashboard) shows the request while it accepts offers:
 * they get `request.updated` when it enters or leaves their explorer.
 */
export async function explorerAudience(request: MatchableRequest & Pick<RequestDoc, 'status'>, session?: ClientSession): Promise<Types.ObjectId[]> {
  if (!requestAcceptsOffers(request.status)) return [];
  return (await findMatchingProfessionals(request, session)).map((match) => match.professionalId);
}
