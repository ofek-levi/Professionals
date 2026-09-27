/**
 * Progress timeline of a customer's request (Published → Offers → Pro selected → Scheduled →
 * In progress → Completed), derived purely from the request status and its job timestamps.
 */
import type { RequestStatus } from '@/constants/request-statuses';
import type { ISODateTimeString, Job, ServiceRequest } from '@/types/domain';

export const REQUEST_TIMELINE_STEPS = ['published', 'offers', 'selected', 'scheduled', 'in_progress', 'completed'] as const;
export type RequestTimelineStepKey = (typeof REQUEST_TIMELINE_STEPS)[number];

export type TimelineStepState = 'done' | 'current' | 'upcoming' | 'cancelled';

export interface TimelineStep {
  key: RequestTimelineStepKey | 'cancelled';
  state: TimelineStepState;
  /** When the step happened (or is planned, for the appointment), if known. */
  at: ISODateTimeString | null;
}

type TimelineRequest = Pick<
  ServiceRequest,
  'status' | 'publishedAt' | 'offerCount' | 'acceptedOfferId' | 'cancelledAt' | 'createdAt' | 'updatedAt'
>;
type TimelineJob = Pick<Job, 'createdAt' | 'confirmedAt' | 'startedAt' | 'completedAt' | 'scheduledStartAt'>;

/**
 * Per status: how many steps are completed and which step is in progress (`null` = none).
 * `in_progress` keeps the "In progress" step current while the work is happening.
 */
const PROGRESS: Record<Exclude<RequestStatus, 'cancelled'>, { done: number; current: number | null }> = {
  draft: { done: 0, current: null },
  open: { done: 1, current: 1 },
  offers_received: { done: 2, current: 2 },
  professional_selected: { done: 3, current: 3 },
  scheduled: { done: 4, current: 4 },
  in_progress: { done: 4, current: 4 },
  completed: { done: 6, current: null },
};

function stepTimestamp(key: RequestTimelineStepKey, request: TimelineRequest, job: TimelineJob | null): ISODateTimeString | null {
  switch (key) {
    case 'published':
      return request.publishedAt;
    case 'offers':
      return null;
    case 'selected':
      return job?.createdAt ?? null;
    case 'scheduled':
      return job?.confirmedAt ?? null;
    case 'in_progress':
      return job?.startedAt ?? null;
    case 'completed':
      return job?.completedAt ?? null;
  }
}

/** How far a cancelled request got before it was cancelled (inferred from its data). */
function cancelledProgress(request: TimelineRequest, job: TimelineJob | null): number {
  if (job?.confirmedAt) return 4;
  if (request.acceptedOfferId) return 3;
  if (request.offerCount > 0) return 2;
  if (request.publishedAt) return 1;
  return 0;
}

export function buildRequestTimeline(request: TimelineRequest, job: TimelineJob | null = null): TimelineStep[] {
  if (request.status === 'cancelled') {
    const reached = cancelledProgress(request, job);
    const steps: TimelineStep[] = REQUEST_TIMELINE_STEPS.slice(0, reached).map((key) => ({
      key,
      state: 'done',
      at: stepTimestamp(key, request, job),
    }));
    steps.push({ key: 'cancelled', state: 'cancelled', at: request.cancelledAt ?? request.updatedAt });
    return steps;
  }

  const { done, current } = PROGRESS[request.status];
  return REQUEST_TIMELINE_STEPS.map((key, index) => {
    const state: TimelineStepState = index === current ? 'current' : index < done ? 'done' : 'upcoming';
    // The appointment time is meaningful before it happens.
    const at = key === 'in_progress' && state !== 'done' && !job?.startedAt ? (job?.scheduledStartAt ?? null) : stepTimestamp(key, request, job);
    return { key, state, at: state === 'upcoming' && key !== 'in_progress' ? null : at };
  });
}
