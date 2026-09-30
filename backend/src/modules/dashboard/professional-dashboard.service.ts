/**
 * `GET /professional/dashboard` (the mock's `getProfessionalDashboard`): the explorer overview
 * (one `$geoNear` aggregation), pending offers, upcoming appointments, recent notifications and
 * this month's earnings — independent, index-bounded queries run in parallel.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { RECENTLY_UPDATED, sortOf } from '../../lib/pagination.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { ProfessionalDashboard } from '../../shared/contract/index.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { ACTIVE_JOB_STATUSES } from '../../shared/statuses.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { toJobSummaries } from '../jobs/jobs.views.js';
import { listRecentNotifications } from '../notifications/notifications.service.js';
import { OfferModel, type OfferDoc } from '../offers/offer.model.js';
import { toOffersWithRequest } from '../offers/offers.views.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { marketMonthStart } from '../requests/market-calendar.js';
import { MATCHABLE_PROJECTION } from '../requests/matching.service.js';
import { nearbyOverview } from '../requests/nearby.service.js';

const PREVIEW_SIZE = 5;

type DashboardProfessional = Pick<ProfessionalDoc, '_id' | 'categoryIds' | 'serviceArea' | 'stats'>;

/** Sum of the agreed prices of jobs completed since the start of the market month. */
async function earningsSince(professional: Types.ObjectId, since: Date): Promise<number> {
  const [row] = await JobModel.aggregate<{ total: number }>([
    { $match: { professional, status: 'completed', completedAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: '$agreedPrice' } } },
  ]);
  return Math.round((row?.total ?? 0) * 100) / 100;
}

export async function getProfessionalDashboard(deps: Pick<AppDeps, 'clock'>, auth: AuthContext): Promise<ProfessionalDashboard> {
  const professional = await ProfessionalModel.findById(auth.userId, { ...MATCHABLE_PROJECTION, 'stats.completedJobsCount': 1 }).lean<DashboardProfessional>();
  if (!professional) throw ApiError.notFound('Professional');
  const pending = { professional: professional._id, status: 'pending' as const };
  const active = { professional: professional._id, status: { $in: [...ACTIVE_JOB_STATUSES] } };
  const [nearby, pendingOffersCount, pendingOffers, activeJobsCount, upcoming, recentNotifications, earnings] = await Promise.all([
    nearbyOverview(professional, PREVIEW_SIZE),
    OfferModel.countDocuments(pending),
    // Most recently updated first: the `{professional, status, updatedAt}` index order, so the
    // preview reads 5 entries instead of sorting every pending offer in memory.
    OfferModel.find(pending).sort(sortOf(RECENTLY_UPDATED)).limit(PREVIEW_SIZE).lean<OfferDoc[]>(),
    JobModel.countDocuments(active),
    JobModel.find(active).sort({ scheduledStartAt: 1, _id: 1 }).limit(PREVIEW_SIZE).lean<JobDoc[]>(),
    listRecentNotifications(auth.userId, PREVIEW_SIZE),
    earningsSince(professional._id, marketMonthStart(deps.clock.now())),
  ]);
  const [offerViews, upcomingAppointments] = await Promise.all([toOffersWithRequest(pendingOffers, auth), toJobSummaries(upcoming)]);
  return {
    nearbyOpenRequestsCount: nearby.count,
    newRequests: nearby.fresh,
    pendingOffersCount,
    pendingOffers: offerViews,
    activeJobsCount,
    upcomingAppointments,
    recentNotifications,
    earningsThisMonth: { amount: earnings, currency: APP_CONFIG.defaultCurrency },
    completedJobsCount: professional.stats.completedJobsCount,
  };
}
