import type { Offer, ServiceRequest } from '@/types/domain';

import type { StoredJob } from '../server/db';

export type JobInput = Pick<StoredJob, 'id' | 'conversationId' | 'createdAt'> & {
  request: Pick<ServiceRequest, 'id' | 'customerId' | 'categoryId' | 'location'>;
  offer: Pick<Offer, 'id' | 'professionalId' | 'price' | 'currency' | 'proposedStartAt' | 'estimatedDurationMinutes'>;
} & Partial<StoredJob>;

/** Builds a job from the request and its accepted offer (defaults to `awaiting_confirmation`). */
export function createJob({ request, offer, ...input }: JobInput): StoredJob {
  return {
    requestId: request.id,
    offerId: offer.id,
    customerId: request.customerId,
    professionalId: offer.professionalId,
    categoryId: request.categoryId,
    status: 'awaiting_confirmation',
    scheduledStartAt: offer.proposedStartAt,
    estimatedDurationMinutes: offer.estimatedDurationMinutes,
    agreedPrice: offer.price,
    currency: offer.currency,
    location: request.location,
    confirmedAt: null,
    startedAt: null,
    completedAt: null,
    completedBy: null,
    cancelledAt: null,
    reviewId: null,
    updatedAt: input.createdAt,
    reminderSentAt: null,
    ...input,
  };
}
