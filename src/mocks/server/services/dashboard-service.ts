/** Aggregated home-screen data for customers and professionals. */
import { APP_CONFIG } from '@/constants/app-config';
import { isJobActive } from '@/features/jobs/job-status-machine';
import { getCustomerRequestSection, requestAcceptsOffers } from '@/features/requests/request-status-machine';
import type { CustomerDashboard, ProfessionalDashboard } from '@/types/api';

import type { CustomerActor, ProfessionalActor } from '../auth';
import type { ServerContext } from '../context';
import type { StoredJob } from '../db';
import { activeOfferRequestIds, requireProfessional } from '../queries';
import { toCustomerRequestView, toJobSummary, toOfferWithRequest, toProfessionalRequestView } from '../views';
import { findNearbyRequests } from './matching-service';
import { recentNotifications } from './notification-service';

const byStartAsc = (a: StoredJob, b: StoredJob) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt);
const byUpdatedDesc = <T extends { updatedAt: string; id: string }>(a: T, b: T) =>
  Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id.localeCompare(a.id);

export function getCustomerDashboard(ctx: ServerContext, actor: CustomerActor): CustomerDashboard {
  const requests = ctx.db.requests.filter((request) => request.customerId === actor.userId);
  const jobs = ctx.db.jobs.filter((job) => job.customerId === actor.userId);
  const activeJobs = jobs.filter((job) => isJobActive(job.status)).sort(byStartAsc);
  const awaitingReview = jobs
    .filter((job) => job.status === 'completed' && job.reviewId === null)
    .sort((a, b) => Date.parse(b.completedAt ?? b.updatedAt) - Date.parse(a.completedAt ?? a.updatedAt));

  return {
    openRequestsCount: requests.filter((request) => requestAcceptsOffers(request.status)).length,
    requestsWithOffersCount: requests.filter((request) => getCustomerRequestSection(request) === 'has_offers').length,
    pendingOffersCount: requests
      .filter((request) => requestAcceptsOffers(request.status))
      .reduce((sum, request) => sum + request.pendingOfferCount, 0),
    activeJobsCount: activeJobs.length,
    recentRequests: [...requests].sort(byUpdatedDesc).slice(0, 5).map((request) => toCustomerRequestView(ctx, request)),
    upcomingJobs: activeJobs.slice(0, 3).map((job) => toJobSummary(ctx, job)),
    jobsAwaitingReview: awaitingReview.map((job) => toJobSummary(ctx, job)),
  };
}

export function getProfessionalDashboard(ctx: ServerContext, actor: ProfessionalActor): ProfessionalDashboard {
  const professional = requireProfessional(ctx.db, actor.professional.id);
  const nearby = findNearbyRequests(ctx, professional, { sort: 'newest' });
  const withMyOffer = activeOfferRequestIds(ctx.db, professional.id);
  const pendingOffers = ctx.db.offers
    .filter((offer) => offer.professionalId === professional.id && offer.status === 'pending')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const jobs = ctx.db.jobs.filter((job) => job.professionalId === professional.id);
  const activeJobs = jobs.filter((job) => isJobActive(job.status)).sort(byStartAsc);

  const now = ctx.now();
  const earnings = jobs
    .filter((job) => {
      if (job.status !== 'completed' || !job.completedAt) return false;
      const completedAt = new Date(job.completedAt);
      return completedAt.getFullYear() === now.getFullYear() && completedAt.getMonth() === now.getMonth();
    })
    .reduce((sum, job) => sum + job.agreedPrice, 0);

  return {
    nearbyOpenRequestsCount: nearby.length,
    newRequests: nearby
      .filter((request) => !withMyOffer.has(request.id))
      .slice(0, 5)
      .map((request) => toProfessionalRequestView(ctx, request, professional)),
    pendingOffersCount: pendingOffers.length,
    pendingOffers: pendingOffers.slice(0, 5).map((offer) => toOfferWithRequest(ctx, offer, actor)),
    activeJobsCount: activeJobs.length,
    upcomingAppointments: activeJobs.slice(0, 5).map((job) => toJobSummary(ctx, job)),
    recentNotifications: recentNotifications(ctx, actor.userId, 5),
    earningsThisMonth: { amount: Math.round(earnings * 100) / 100, currency: APP_CONFIG.defaultCurrency },
    completedJobsCount: professional.stats.completedJobsCount,
  };
}
