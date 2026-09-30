/**
 * Request rules ported from the app (`features/requests/request-status-machine.ts`,
 * `lib/validation/request.ts`): the status machine, the `open ⇄ offers_received` flip, the
 * customer's list sections and the preferred-date rules (evaluated on the server clock).
 */
import type { QueryFilter } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { APP_CONFIG } from '../../shared/limits.js';
import type { CustomerRequestSection, RequestStatus } from '../../shared/statuses.js';
import type { UrgencyLevel } from '../../shared/urgency.js';
import { vm, type ValidationMessage } from '../../shared/validation-messages.js';
import { latestAllowedOfferStart } from '../offers/offer-rules.js';
import { daysBetweenDateKeys, isValidDateKey, marketDateKey, marketMidnight } from './market-calendar.js';
import type { RequestDoc } from './request.model.js';

const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  draft: ['open', 'cancelled'],
  open: ['offers_received', 'cancelled'],
  offers_received: ['open', 'professional_selected', 'cancelled'],
  professional_selected: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
};

/** 409 `INVALID_STATE_TRANSITION` for a disallowed move. */
export function assertRequestTransition(from: RequestStatus, to: RequestStatus): void {
  if (!REQUEST_TRANSITIONS[from].includes(to)) throw ApiError.invalidTransition('request', from, to);
}

/** Status after the pending offer count changed (`open ⇄ offers_received`); others unchanged. */
export function requestStatusForPendingOffers(status: RequestStatus, pendingOfferCount: number): RequestStatus {
  if (status === 'open' && pendingOfferCount > 0) return 'offers_received';
  if (status === 'offers_received' && pendingOfferCount === 0) return 'open';
  return status;
}

/** Filter selecting the requests of one "My requests" section (each request is in exactly one). */
export function sectionFilter(section: CustomerRequestSection): QueryFilter<RequestDoc> {
  switch (section) {
    case 'drafts':
      return { status: 'draft' };
    case 'awaiting_offers':
      return { status: 'open', pendingOfferCount: 0 };
    case 'has_offers':
      return { $or: [{ status: 'offers_received' }, { status: 'open', pendingOfferCount: { $gt: 0 } }] };
    case 'active':
      return { status: { $in: ['professional_selected', 'scheduled', 'in_progress'] } };
    case 'completed':
      return { status: 'completed' };
    case 'cancelled':
      return { status: 'cancelled' };
  }
}

/**
 * Preferred date rule: a real day, not before today, at most `maxScheduleDaysAhead` ahead, and
 * starting before the latest start an offer may propose for the urgency (emergency ≤ 24 h,
 * urgent ≤ 72 h). Returns the i18n key of the first broken rule.
 */
function preferredDateIssue(dateKey: string, urgency: UrgencyLevel, now: Date): ValidationMessage | null {
  if (!isValidDateKey(dateKey)) return vm('request.preferredDateInvalid');
  const days = daysBetweenDateKeys(marketDateKey(now), dateKey);
  if (days < 0) return vm('request.preferredDateInPast');
  if (days > APP_CONFIG.maxScheduleDaysAhead) return vm('request.preferredDateTooFar');
  if (marketMidnight(dateKey).getTime() > latestAllowedOfferStart(urgency, now).getTime()) {
    return vm('request.preferredDateBeyondUrgency');
  }
  return null;
}

export function assertPreferredSchedule(schedule: { date: string } | null, urgency: UrgencyLevel, now: Date): void {
  if (!schedule) return;
  const issue = preferredDateIssue(schedule.date, urgency, now);
  if (issue) throw ApiError.validation({ 'preferredSchedule.date': [issue] });
}
