/**
 * View-model helpers for the customer home tab (pure, unit tested).
 */
import type { CustomerRequestSection } from '@/constants/request-statuses';
import type { CustomerDashboard } from '@/types/api';

export const GREETING_PERIODS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type GreetingPeriod = (typeof GREETING_PERIODS)[number];

/** Time-of-day bucket for the home greeting (local time). */
export function getGreetingPeriod(date: Date): GreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/** Where the "offers waiting" attention card leads. */
export type AttentionTarget = { kind: 'request'; requestId: string } | { kind: 'section'; section: CustomerRequestSection };

/**
 * With a single request waiting for a decision (and visible among the recent requests) the card
 * opens that request directly; otherwise the "With offers" section of My Requests.
 */
export function getOffersAttentionTarget(
  dashboard: Pick<CustomerDashboard, 'requestsWithOffersCount' | 'recentRequests'>,
): AttentionTarget {
  if (dashboard.requestsWithOffersCount === 1) {
    const request = dashboard.recentRequests.find((item) => item.pendingOfferCount > 0 && item.status !== 'draft');
    if (request) return { kind: 'request', requestId: request.id };
  }
  return { kind: 'section', section: 'has_offers' };
}

/** `true` once the customer has created anything (drives the "How it works" explainer). */
export function hasCustomerActivity(
  dashboard: Pick<CustomerDashboard, 'recentRequests' | 'upcomingJobs' | 'jobsAwaitingReview' | 'openRequestsCount' | 'activeJobsCount'>,
): boolean {
  return (
    dashboard.recentRequests.length > 0 ||
    dashboard.upcomingJobs.length > 0 ||
    dashboard.jobsAwaitingReview.length > 0 ||
    dashboard.openRequestsCount > 0 ||
    dashboard.activeJobsCount > 0
  );
}
