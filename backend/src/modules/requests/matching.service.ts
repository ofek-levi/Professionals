/**
 * Matching between requests and professionals (the app's `features/requests/request-matching.ts`):
 * the professional covers the request's category and the request lies within their service radius
 * (haversine from the service-area center). Every professional-facing distance is measured to the
 * request's approximate pin (`publicPoint`), never to the exact address.
 */
import type { Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { fromGeoPoint, haversineDistanceKm, roundDistanceKm } from '../../lib/geo.js';
import type { GeoCoordinates } from '../../shared/contract/index.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { matchingProfessionalsStages } from '../professionals/service-area-coverage.js';
import type { RequestDoc } from './request.model.js';

/** The parts of a professional that matching depends on. */
export type MatchableProfessional = Pick<ProfessionalDoc, '_id' | 'categoryIds' | 'serviceArea'>;
export const MATCHABLE_PROJECTION = { categoryIds: 1, serviceArea: 1 } as const;

export type MatchableRequest = Pick<RequestDoc, 'categoryId' | 'publicPoint'>;

/** The caller's matching profile (a professional account always has one). */
export async function loadMatchableProfessional(professionalId: Types.ObjectId): Promise<MatchableProfessional> {
  const professional = await ProfessionalModel.findById(professionalId, MATCHABLE_PROJECTION).lean<MatchableProfessional>();
  if (!professional) throw ApiError.notFound('Professional');
  return professional;
}

export function serviceAreaCenter(professional: Pick<ProfessionalDoc, 'serviceArea'>): GeoCoordinates {
  return fromGeoPoint(professional.serviceArea.center);
}

/** The point professionals are matched and measured against (the approximate pin). */
function requestCoordinates(request: Pick<RequestDoc, 'publicPoint'>): GeoCoordinates {
  return fromGeoPoint(request.publicPoint);
}

/** Exact distance (km) from the service-area center to the request. */
function exactDistanceKm(professional: Pick<ProfessionalDoc, 'serviceArea'>, request: Pick<RequestDoc, 'publicPoint'>): number {
  return haversineDistanceKm(serviceAreaCenter(professional), requestCoordinates(request));
}

/** The distance the app shows (0.1 km precision). */
export function distanceKm(professional: Pick<ProfessionalDoc, 'serviceArea'>, request: Pick<RequestDoc, 'publicPoint'>): number {
  return roundDistanceKm(exactDistanceKm(professional, request));
}

export function coversCategory(professional: Pick<ProfessionalDoc, 'categoryIds'>, categoryId: string): boolean {
  return (professional.categoryIds as readonly string[]).includes(categoryId);
}

export function isWithinServiceArea(professional: Pick<ProfessionalDoc, 'serviceArea'>, request: Pick<RequestDoc, 'publicPoint'>): boolean {
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
 * Professionals whose categories and service area cover the request, nearest first (one
 * aggregation, see `matchingProfessionalsStages`). Reads professionals only: callers run it after
 * their transaction commits, never inside it.
 */
export async function findMatchingProfessionals(request: MatchableRequest): Promise<ProfessionalMatch[]> {
  const rows = await ProfessionalModel.aggregate<{ _id: Types.ObjectId; distanceKm: number }>([
    ...matchingProfessionalsStages(requestCoordinates(request), request.categoryId),
    { $project: { _id: 1, distanceKm: 1 } },
    { $sort: { distanceKm: 1, _id: 1 } },
  ]);
  return rows.map((row) => ({ professionalId: row._id, distanceKm: roundDistanceKm(row.distanceKm) }));
}
