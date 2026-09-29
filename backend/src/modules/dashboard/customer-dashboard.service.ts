/**
 * `GET /customer/dashboard` (the mock's `getCustomerDashboard`): counters from one aggregation over
 * the customer's requests that take offers, plus short previews (recent requests, next jobs, jobs
 * awaiting a review), every query index-bounded and run in parallel.
 */
import type { Types } from 'mongoose';

import type { AuthContext } from '../../middleware/auth.js';
import type { CustomerDashboard } from '../../shared/contract/index.js';
import { ACTIVE_JOB_STATUSES, REQUEST_STATUSES_ACCEPTING_OFFERS } from '../../shared/statuses.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { toJobSummaries } from '../jobs/jobs.views.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { toCustomerRequestViews } from '../requests/requests.views.js';

const RECENT_REQUESTS = 5;
const UPCOMING_JOBS = 3;
/** Completed jobs still waiting for a review (the app shows the first and marks the rest in lists). */
const AWAITING_REVIEW = 20;

interface RequestCounters {
  openRequestsCount: number;
  requestsWithOffersCount: number;
  pendingOffersCount: number;
}

async function requestCounters(customer: Types.ObjectId): Promise<RequestCounters> {
  const accepting = [...REQUEST_STATUSES_ACCEPTING_OFFERS];
  const [row] = await RequestModel.aggregate<RequestCounters>([
    { $match: { customer, status: { $in: accepting } } },
    {
      $group: {
        _id: null,
        openRequestsCount: { $sum: 1 },
        // The "has offers" section: offers_received, or open with pending offers.
        requestsWithOffersCount: {
          $sum: { $cond: [{ $or: [{ $eq: ['$status', 'offers_received'] }, { $gt: ['$pendingOfferCount', 0] }] }, 1, 0] },
        },
        pendingOffersCount: { $sum: '$pendingOfferCount' },
      },
    },
  ]);
  return {
    openRequestsCount: row?.openRequestsCount ?? 0,
    requestsWithOffersCount: row?.requestsWithOffersCount ?? 0,
    pendingOffersCount: row?.pendingOffersCount ?? 0,
  };
}

export async function getCustomerDashboard(auth: AuthContext): Promise<CustomerDashboard> {
  const customer = auth.userId;
  const active = { customer, status: { $in: [...ACTIVE_JOB_STATUSES] } };
  const [counters, recent, activeJobsCount, upcoming, awaitingReview] = await Promise.all([
    requestCounters(customer),
    RequestModel.find({ customer }).sort({ updatedAt: -1, _id: -1 }).limit(RECENT_REQUESTS).lean<RequestDoc[]>(),
    JobModel.countDocuments(active),
    JobModel.find(active).sort({ scheduledStartAt: 1, _id: 1 }).limit(UPCOMING_JOBS).lean<JobDoc[]>(),
    JobModel.find({ customer, status: 'completed', review: null }).sort({ completedAt: -1, _id: -1 }).limit(AWAITING_REVIEW).lean<JobDoc[]>(),
  ]);
  const [recentRequests, jobSummaries] = await Promise.all([toCustomerRequestViews(recent), toJobSummaries([...upcoming, ...awaitingReview])]);
  return {
    ...counters,
    activeJobsCount,
    recentRequests,
    upcomingJobs: jobSummaries.slice(0, upcoming.length),
    jobsAwaitingReview: jobSummaries.slice(upcoming.length),
  };
}
