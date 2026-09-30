/**
 * `GET /professionals`: browse by category, best ranked first (Bayesian rating `stats.rankScore`,
 * then review count), optionally only those whose service area covers a point (then nearer first
 * among equals) — the order of the app's reference backend, as keyset pages. "Covers" and "nearer"
 * use the approximate center the public profile shows, at 0.1 km: cursors carry the sort values,
 * so nothing finer than what the profile already reveals may go into them.
 */
import type { PipelineStage, Types } from 'mongoose';

import { loadByIds } from '../../lib/batch.js';
import { findPage, pageStages, readCursor, toPage, type SortSpec } from '../../lib/pagination.js';
import type { GeoCoordinates, Paginated, ProfessionalSummary } from '../../shared/contract/index.js';
import type { CategoryId } from '../../shared/catalog/index.js';
import { NOT_DELETED, UserModel, type UserDoc } from '../users/user.model.js';
import { ProfessionalModel, type ProfessionalDoc } from './professional.model.js';
import { PROFESSIONAL_SUMMARY_PROJECTION, toProfessionalSummary } from './professional.views.js';
import { publicCoverageStages } from './service-area-coverage.js';
import type { SearchProfessionalsInput } from './professionals.schemas.js';

type SearchHit = Pick<
  ProfessionalDoc,
  '_id' | 'displayName' | 'headline' | 'categoryIds' | 'yearsOfExperience' | 'stats' | 'isVerified' | 'baseLocation' | 'serviceArea' | 'deletedAt'
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

/** A deleted professional's tombstone has no categories: without a category it is filtered out. */
function categoryFilter(categoryId: CategoryId | undefined): Record<string, unknown> {
  return categoryId ? { categoryIds: categoryId } : NOT_DELETED;
}

async function searchNear(near: GeoCoordinates, query: SearchProfessionalsInput): Promise<Paginated<SearchHit>> {
  const page = { cursor: query.cursor, limit: query.limit };
  const cursor = readCursor(page, RANKED_NEAR);
  const base: PipelineStage[] = [
    ...publicCoverageStages(near, query.categoryId),
    { $set: { distanceKm: { $divide: [{ $floor: { $add: [{ $multiply: ['$distanceKm', 10] }, 0.5] } }, 10] } } },
  ];
  const [docs, total] = await Promise.all([
    ProfessionalModel.aggregate<SearchHit>([
      ...base,
      ...pageStages(RANKED_NEAR, cursor, page.limit),
      { $project: { ...PROFESSIONAL_SUMMARY_PROJECTION, distanceKm: 1 } },
    ]),
    // The count repeats the whole coverage scan: first page only (later pages echo it from the cursor).
    cursor ? cursor.totalCount : ProfessionalModel.aggregate<{ total: number }>([...base, { $count: 'total' }]).then((rows) => rows[0]?.total ?? 0),
  ]);
  return toPage(docs, page, RANKED_NEAR, total);
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
