/**
 * `AccountDeletionImpact` DTO: how many requests, offers and jobs the deletion changes, and the
 * first few of each with the other party's name (one users lookup for all of them).
 */
import type { Types } from 'mongoose';

import { loadByIds, required } from '../../lib/batch.js';
import type { AccountDeletionImpact, DeletionImpactItem, DeletionImpactList, DeletionReauthentication } from '../../shared/contract/index.js';
import type { JobStatus } from '../../shared/statuses.js';
import { API_LIMITS } from '../../shared/limits.js';
import type { JobDoc } from '../jobs/job.model.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { pendingOffersOn, type DeletionImpact } from './account-deletion.impact.js';
import { loadUserDisplays } from './user-display.views.js';

type Names = (userId: Types.ObjectId | undefined) => string | null;

async function loadNames(userIds: (Types.ObjectId | undefined)[]): Promise<Names> {
  const displays = await loadUserDisplays(userIds.filter((id) => id !== undefined));
  // `shortName`: "Noa L." for a customer, the display name for a professional.
  return (userId) => (userId ? (displays.get(userId.toHexString())?.shortName ?? null) : null);
}

/** The items a list shows (its count covers them all). */
function shown<T>(docs: T[]): T[] {
  return docs.slice(0, API_LIMITS.deletionImpactItems);
}

function list<Doc, Status extends string>(docs: Doc[], toItem: (doc: Doc) => DeletionImpactItem<Status>): DeletionImpactList<Status> {
  return { count: docs.length, items: shown(docs).map(toItem) };
}

function jobItem(job: JobDoc, counterpartName: string | null): DeletionImpactItem<JobStatus> {
  return {
    id: job._id.toHexString(),
    requestId: job.request.toHexString(),
    categoryId: job.categoryId,
    status: job.status,
    date: job.scheduledStartAt.toISOString(),
    counterpartName,
  };
}

export async function toDeletionImpactDto(impact: DeletionImpact, reauthentication: DeletionReauthentication): Promise<AccountDeletionImpact> {
  if (impact.role === 'customer') {
    // A request with an active job is that job's request: its counterpart is the hired professional.
    const hiredFor = new Map(impact.jobs.map((job) => [job.request.toHexString(), job.professional]));
    const hiredOf = (request: RequestDoc) => hiredFor.get(request._id.toHexString());
    const name = await loadNames([...shown(impact.requests).map(hiredOf), ...shown(impact.jobs).map((job) => job.professional)]);
    return {
      role: 'customer',
      reauthentication,
      requestsToCancel: list(impact.requests, (request) => ({
        id: request._id.toHexString(),
        requestId: request._id.toHexString(),
        categoryId: request.categoryId,
        status: request.status,
        date: (request.publishedAt ?? request.createdAt).toISOString(),
        counterpartName: name(hiredOf(request)),
      })),
      offersToDecline: pendingOffersOn(impact.requests),
      draftsToDelete: impact.drafts.length,
      jobsToCancel: list(impact.jobs, (job) => jobItem(job, name(job.professional))),
    };
  }
  const offers = shown(impact.offers);
  const requests = await loadByIds<RequestDoc, Pick<RequestDoc, '_id' | 'categoryId' | 'customer'>>(
    RequestModel,
    offers.map((offer) => offer.request),
    { categoryId: 1, customer: 1 },
  );
  const requestOf = (requestId: Types.ObjectId) => required(requests, requestId, 'Request');
  const name = await loadNames([...[...requests.values()].map((request) => request.customer), ...shown(impact.jobs).map((job) => job.customer)]);
  return {
    role: 'professional',
    reauthentication,
    offersToWithdraw: list(impact.offers, (offer) => ({
      id: offer._id.toHexString(),
      requestId: offer.request.toHexString(),
      categoryId: requestOf(offer.request).categoryId,
      status: offer.status,
      date: offer.proposedStartAt.toISOString(),
      counterpartName: name(requestOf(offer.request).customer),
    })),
    jobsToCancel: list(impact.jobs, (job) => jobItem(job, name(job.customer))),
  };
}
