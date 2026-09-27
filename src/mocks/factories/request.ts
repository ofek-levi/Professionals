import type { ServiceRequest } from '@/types/domain';

export type RequestInput = Pick<ServiceRequest, 'id' | 'customerId' | 'categoryId' | 'location' | 'createdAt'> &
  Partial<ServiceRequest>;

/**
 * Builds a request. Defaults: published (`open`) at `createdAt`, normal urgency, no offers.
 * Counters are recomputed from offers by the seed / lifecycle service.
 */
export function createRequest(input: RequestInput): ServiceRequest {
  const status = input.status ?? 'open';
  return {
    description: 'Looking for a reliable professional for a job at home. More details on request.',
    urgency: 'normal',
    preferredSchedule: null,
    photos: [],
    notes: null,
    status,
    offerCount: 0,
    pendingOfferCount: 0,
    acceptedOfferId: null,
    jobId: null,
    publishedAt: status === 'draft' ? null : input.createdAt,
    cancelledAt: null,
    cancellationReason: null,
    updatedAt: input.createdAt,
    ...input,
  };
}
