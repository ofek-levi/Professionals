/**
 * View-model helpers for the customer's Home and Requests tabs (pure, unit tested): which
 * requests are "active" or "past", and in which order they need the customer.
 */
import { getRequestStatusLine } from '@/components/requests/request-status-line';
import type { RequestStatus } from '@/constants/request-statuses';
import type { CustomerRequestView, ISODateTimeString, JobSummary } from '@/types/domain';

/** Requests tab segments. */
export type RequestListTab = 'active' | 'past';

/** Statuses of each Requests tab segment (`statuses` filter of `GET /customer/requests`). */
export const REQUEST_TAB_STATUSES: Record<RequestListTab, readonly RequestStatus[]> = {
  active: ['draft', 'open', 'offers_received', 'professional_selected', 'scheduled', 'in_progress'],
  past: ['completed', 'cancelled'],
};

/** The Requests tab segment for a `?tab=` value (unknown/missing → `active`). */
export function parseRequestListTab(tab: string | undefined): RequestListTab {
  if (tab === 'active' || tab === 'past') return tab;
  return 'active';
}

type RankedRequest = Pick<CustomerRequestView, 'status' | 'pendingOfferCount'>;

/**
 * What a request needs from the customer, most pressing first: offers to review, then booked
 * work, then requests still waiting for offers, then drafts.
 */
function requestAttentionRank(request: RankedRequest): number {
  switch (getRequestStatusLine(request).kind) {
    case 'offersToReview':
      return 0;
    case 'inProgress':
    case 'booked':
      return 1;
    case 'waitingForOffers':
      return 2;
    case 'draft':
      return 3;
    default:
      return 4;
  }
}

/** Active requests ordered by what needs the customer (stable: keeps the server order otherwise). */
export function sortActiveRequests<T extends RankedRequest>(requests: readonly T[]): T[] {
  return requests
    .map((request, index) => ({ request, index, rank: requestAttentionRank(request) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.request);
}

/** Appointment time per request id, from the customer's jobs. */
export function appointmentsByRequest(jobs: readonly Pick<JobSummary, 'requestId' | 'scheduledStartAt'>[]): Map<string, ISODateTimeString> {
  return new Map(jobs.map((job) => [job.requestId, job.scheduledStartAt]));
}

/** One row of the Home tab's "Active" section. */
export type HomeActiveRow =
  | { kind: 'request'; request: CustomerRequestView; appointmentAt: ISODateTimeString | null }
  | { kind: 'review'; job: JobSummary };

const HOME_ACTIVE_LIMIT = 3;

/**
 * Up to `limit` rows ordered by what needs the customer: requests with offers to review, the most
 * recent completed job without a review ("Rate CoolAir HVAC"), booked work (soonest first),
 * requests waiting for offers and drafts.
 */
export function buildHomeActiveRows(
  input: {
    requests: readonly CustomerRequestView[];
    upcomingJobs: readonly Pick<JobSummary, 'requestId' | 'scheduledStartAt'>[];
    jobsAwaitingReview: readonly JobSummary[];
  },
  limit: number = HOME_ACTIVE_LIMIT,
): HomeActiveRow[] {
  const appointments = appointmentsByRequest(input.upcomingJobs);
  const time = (value: string | null | undefined, fallback: number) => (value ? Date.parse(value) : fallback);

  const ranked = input.requests
    .filter((request) => requestAttentionRank(request) < 4)
    .map((request, index) => {
      const appointmentAt = appointments.get(request.id) ?? null;
      const rank = requestAttentionRank(request);
      // Offers: newest first. Booked: soonest appointment first. Others: server order.
      const key =
        rank === 0 ? -time(request.latestOfferAt, 0) : rank === 1 ? time(appointmentAt, Number.MAX_SAFE_INTEGER) : index;
      return { row: { kind: 'request', request, appointmentAt } as HomeActiveRow, rank: rank === 0 ? 0 : rank + 1, key };
    });

  const review = input.jobsAwaitingReview[0];
  if (review) ranked.push({ row: { kind: 'review', job: review }, rank: 1, key: 0 });

  return ranked
    .sort((a, b) => a.rank - b.rank || a.key - b.key)
    .slice(0, limit)
    .map((entry) => entry.row);
}
