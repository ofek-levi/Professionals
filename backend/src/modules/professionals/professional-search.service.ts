/**
 * `GET /professionals`: browse by category, best ranked first (Bayesian rating `stats.rankScore`,
 * then review count), optionally only those whose service area covers a point (then nearer first
 * among equals) — the order of the app's reference backend, as keyset pages.
 */
import type { PipelineStage, Types } from 'mongoose';

import { loadByIds } from '../../lib/batch.js';
import { geoNearStage } from '../../lib/geo-near.js';
import { findPage, pageStages, toPage, type SortSpec } from '../../lib/pagination.js';
import type { GeoCoordinates, Paginated, ProfessionalSummary } from '../../shared/contract/index.js';
import type { CategoryId } from '../../shared/catalog/index.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { ProfessionalModel, type ProfessionalDoc } from './professional.model.js';
import { PROFESSIONAL_SUMMARY_PROJECTION, toProfessionalSummary } from './professional.views.js';
import type { SearchProfessionalsInput } from './professionals.schemas.js';

type SearchHit = Pick<
  ProfessionalDoc,
  '_id' | 'displayName' | 'headline' | 'categoryIds' | 'yearsOfExperience' | 'stats' | 'isVerified' | 'baseLocation' | 'serviceArea'
>;

const RANKED: SortSpec = [
  { path: 'stats.rankScore', direction: -1 },
  { path: 'stats.reviewCount', direction: -1 },
  { path: '_id', direction: 1 },
];
const RANKED_NEAR: SortSpec = [
  { path: 'stats.rankScore', direction: -1 },
  { path: 'stats.reviewCount', direction: -1 },
  { path: 'distanceKm', direction: 1 },
  { path: '_id', direction: 1 },
];

function categoryFilter(categoryId: CategoryId | undefined): Record<string, unknown> {
  return categoryId ? { categoryIds: categoryId } : {};
}

/**
 * Professionals whose own radius covers `near`: `$geoNear` bounded by the largest radius the app
 * allows (2dsphere + category index), then each one's `radiusKm`. Distances are haversine km (the
 * app's rule), so "covers" matches `isWithinServiceArea` exactly.
 */
function coveringStages(near: GeoCoordinates, categoryId: CategoryId | undefined): PipelineStage[] {
  return [
    geoNearStage({
      near,
      key: 'serviceArea.center',
      distanceField: 'distanceKm',
      maxDistanceKm: APP_CONFIG.maxServiceRadiusKm,
      query: categoryFilter(categoryId),
    }),
    { $match: { $expr: { $lte: ['$distanceKm', '$serviceArea.radiusKm'] } } },
  ];
}

async function searchNear(near: GeoCoordinates, query: SearchProfessionalsInput): Promise<Paginated<SearchHit>> {
  const page = { cursor: query.cursor, limit: query.limit };
  const base = coveringStages(near, query.categoryId);
  const [docs, counted] = await Promise.all([
    ProfessionalModel.aggregate<SearchHit>([...base, ...pageStages(RANKED_NEAR, page), { $project: { ...PROFESSIONAL_SUMMARY_PROJECTION, distanceKm: 1 } }]),
    ProfessionalModel.aggregate<{ total: number }>([...base, { $count: 'total' }]),
  ]);
  return toPage(docs, page, RANKED_NEAR, counted[0]?.total ?? 0);
}

export async function searchProfessionals(query: SearchProfessionalsInput): Promise<Paginated<ProfessionalSummary>> {
  const page = query.near
    ? await searchNear(query.near, query)
    : await findPage<ProfessionalDoc, SearchHit>(ProfessionalModel, {
        filter: categoryFilter(query.categoryId),
        sort: RANKED,
        page: { cursor: query.cursor, limit: query.limit },
        projection: PROFESSIONAL_SUMMARY_PROJECTION,
      });
  const avatars = await loadByIds<UserDoc, Pick<UserDoc, '_id' | 'avatar'>>(UserModel, page.items.map((pro): Types.ObjectId => pro._id), { avatar: 1 });
  return { ...page, items: page.items.map((pro) => toProfessionalSummary(pro, avatars.get(pro._id.toHexString()))) };
}
