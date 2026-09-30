/**
 * The professional job explorer (`GET /professional/requests/nearby`, the app's
 * `filterNearbyRequests` + `sortNearbyRequests`): requests that accept offers in the professional's
 * categories within their radius (or a smaller `maxDistanceKm`), filtered and sorted like the app,
 * as keyset pages over one `$geoNear` aggregation (page and total in a single `$facet`).
 */
import type { PipelineStage, Types } from 'mongoose';

import { geoNearStage } from '../../lib/geo-near.js';
import { pageStages, readCursor, sortOf, toPage, type PageParams, type SortSpec } from '../../lib/pagination.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { Paginated, ProfessionalRequestView } from '../../shared/contract/index.js';
import type { NearbyRequestSort } from '../../shared/domain.js';
import { REQUEST_STATUSES_ACCEPTING_OFFERS } from '../../shared/statuses.js';
import { URGENCY_LEVELS, URGENCY_META } from '../../shared/urgency.js';
import { pendingOfferRequestIds } from '../offers/offer-lookups.js';
import { serviceAreaCenter, loadMatchableProfessional, type MatchableProfessional } from './matching.service.js';
import { RequestModel, type RequestDoc } from './request.model.js';
import type { NearbyRequestsQuery } from './requests.schemas.js';
import { toProfessionalRequestViews } from './requests.views.js';

/** Sort keys computed per request (`recency` = publication time; urgency as its priority). */
type NearbyHit = RequestDoc & { distanceKm: number; recency: Date; urgencyRank: number };

const NEWEST: SortSpec = [
  { path: 'recency', direction: -1 },
  { path: '_id', direction: 1 },
];
const SORTS: Record<NearbyRequestSort, SortSpec> = {
  newest: NEWEST,
  // The app sorts on the distance it shows (0.1 km), newest first among equals.
  nearest: [{ path: 'distanceKm', direction: 1 }, ...NEWEST],
  most_urgent: [{ path: 'urgencyRank', direction: 1 }, ...NEWEST],
  fewest_offers: [{ path: 'pendingOfferCount', direction: 1 }, ...NEWEST],
};

const URGENCY_BY_PRIORITY = [...URGENCY_LEVELS].sort((a, b) => URGENCY_META[a].priority - URGENCY_META[b].priority);

interface NearbyFilters {
  categoryIds?: readonly string[] | undefined;
  maxDistanceKm?: number | undefined;
  urgencies?: readonly string[] | undefined;
  preferredDateFrom?: string | undefined;
  preferredDateTo?: string | undefined;
  offerPresence?: 'any' | 'no_offers' | 'has_offers' | undefined;
  excludeRequestIds?: readonly Types.ObjectId[];
}

/** `$geoNear` + computed sort keys, or `null` when the filters exclude everything. */
function nearbyStages(professional: MatchableProfessional, filters: NearbyFilters): PipelineStage[] | null {
  const own = new Set<string>(professional.categoryIds);
  const categories = filters.categoryIds?.length ? filters.categoryIds.filter((id) => own.has(id)) : [...own];
  if (categories.length === 0) return null;
  const radiusKm = professional.serviceArea.radiusKm;
  const query: Record<string, unknown> = {
    status: { $in: [...REQUEST_STATUSES_ACCEPTING_OFFERS] },
    categoryId: { $in: categories },
  };
  if (filters.urgencies?.length) query.urgency = { $in: filters.urgencies };
  // Competition = live offers; expired or rejected ones no longer compete.
  if (filters.offerPresence === 'no_offers') query.pendingOfferCount = 0;
  if (filters.offerPresence === 'has_offers') query.pendingOfferCount = { $gt: 0 };
  if (filters.excludeRequestIds?.length) query._id = { $nin: filters.excludeRequestIds };
  if (filters.preferredDateFrom || filters.preferredDateTo) {
    // String comparison on `YYYY-MM-DD`; requests without a preferred date never match.
    query['preferredSchedule.date'] = {
      ...(filters.preferredDateFrom ? { $gte: filters.preferredDateFrom } : { $type: 'string' }),
      ...(filters.preferredDateTo ? { $lte: filters.preferredDateTo } : {}),
    };
  }
  return [
    geoNearStage({
      near: serviceAreaCenter(professional),
      key: 'publicPoint', // distances and filters never see the exact address
      distanceField: 'distanceKm',
      maxDistanceKm: filters.maxDistanceKm !== undefined ? Math.min(filters.maxDistanceKm, radiusKm) : radiusKm,
      query,
    }),
    {
      $addFields: {
        distanceKm: { $divide: [{ $floor: { $add: [{ $multiply: ['$distanceKm', 10] }, 0.5] } }, 10] },
        recency: { $ifNull: ['$publishedAt', '$createdAt'] },
        urgencyRank: { $indexOfArray: [URGENCY_BY_PRIORITY, '$urgency'] },
      },
    },
  ];
}

/** One page; the total (a `$facet` over the whole radius) only on the first page, echoed after. */
async function nearbyPage(stages: PipelineStage[], sort: SortSpec, page: PageParams): Promise<Paginated<NearbyHit>> {
  const cursor = readCursor(page, sort);
  const items = pageStages(sort, cursor, page.limit);
  if (cursor) return toPage(await RequestModel.aggregate<NearbyHit>([...stages, ...items]), page, sort, cursor.totalCount);
  const [result] = await RequestModel.aggregate<{ items: NearbyHit[]; total: { count: number }[] }>([
    ...stages,
    { $facet: { items: items as PipelineStage.FacetPipelineStage[], total: [{ $count: 'count' }] } },
  ]);
  return toPage(result?.items ?? [], page, sort, result?.total[0]?.count ?? 0);
}

export async function listNearbyRequests(auth: AuthContext, query: NearbyRequestsQuery): Promise<Paginated<ProfessionalRequestView>> {
  const [professional, excludeRequestIds] = await Promise.all([
    loadMatchableProfessional(auth.userId),
    query.excludeWithMyOffer ? pendingOfferRequestIds(auth.userId) : [],
  ]);
  const stages = nearbyStages(professional, { ...query, excludeRequestIds });
  if (!stages) return { items: [], nextCursor: null, totalCount: 0 };
  const page = await nearbyPage(stages, SORTS[query.sort ?? 'newest'], { cursor: query.cursor, limit: query.limit });
  return { ...page, items: await toProfessionalRequestViews(page.items, professional) };
}

/**
 * Dashboard view of the explorer: how many requests it shows and the newest ones the professional
 * has not sent an offer to yet (one aggregation).
 */
export async function nearbyOverview(
  professional: MatchableProfessional,
  limit: number,
): Promise<{ count: number; fresh: ProfessionalRequestView[] }> {
  const stages = nearbyStages(professional, {});
  if (!stages) return { count: 0, fresh: [] };
  const withMyOffer = await pendingOfferRequestIds(professional._id);
  const [result] = await RequestModel.aggregate<{ fresh: NearbyHit[]; total: { count: number }[] }>([
    ...stages,
    {
      $facet: {
        fresh: [{ $match: { _id: { $nin: withMyOffer } } }, { $sort: sortOf(NEWEST) }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  return { count: result?.total[0]?.count ?? 0, fresh: await toProfessionalRequestViews(result?.fresh ?? [], professional) };
}
