import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import type { OfferDetails } from '@/hooks/queries/use-offer-queries';
import { useQueryScope } from '@/hooks/queries/query-scope';
import { api } from '@/services/api';
import type { CreateOfferPayload, RequestDetailsResponse, UpdateOfferPayload } from '@/types/api';
import type { Offer } from '@/types/domain';

import { mergeRequestIntoDetail } from './cache-updates';
import { invalidateConversation, invalidateJobGraph, invalidateOfferGraph } from './invalidation';

/** Merges an updated `Offer` into a cached offer detail (keeps professional/request info). */
function mergeOfferDetail(qc: QueryClient, userId: string | null, offer: Offer): void {
  qc.setQueryData<OfferDetails>(queryKeys.offers.detail(userId, offer.id), (current) =>
    current ? { ...current, ...offer } : current,
  );
}

export interface CreateOfferVariables {
  requestId: string;
  payload: CreateOfferPayload;
}

/** `POST /requests/:id/offers` (professional). */
export function useCreateOffer() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: ({ requestId, payload }: CreateOfferVariables) => api.offers.createOffer(requestId, payload),
    onSuccess: (offer) => {
      void invalidateOfferGraph(qc, userId, { offerId: offer.id, requestId: offer.requestId });
    },
  });
}

export interface UpdateOfferVariables {
  offerId: string;
  payload: UpdateOfferPayload;
}

/** `PATCH /offers/:id` – edit a pending offer (professional). */
export function useUpdateOffer() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: ({ offerId, payload }: UpdateOfferVariables) => api.offers.updateOffer(offerId, payload),
    onSuccess: (offer) => {
      mergeOfferDetail(qc, userId, offer);
      void invalidateOfferGraph(qc, userId, { offerId: offer.id, requestId: offer.requestId });
    },
  });
}

/** `POST /offers/:id/withdraw` (professional). */
export function useWithdrawOffer() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: (offerId: string) => api.offers.withdrawOffer(offerId),
    onSuccess: (offer) => {
      mergeOfferDetail(qc, userId, offer);
      void invalidateOfferGraph(qc, userId, { offerId: offer.id, requestId: offer.requestId });
    },
  });
}

/**
 * `POST /offers/:id/accept` (customer). Resolves with `{ offer, request, job }`; the request detail
 * is updated immediately from the response, then the request, its offers, the dashboards, jobs and
 * conversations are refreshed.
 */
export function useAcceptOffer() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: (offerId: string) => api.offers.acceptOffer(offerId),
    onSuccess: ({ offer, request, job }) => {
      qc.setQueryData<RequestDetailsResponse>(queryKeys.requests.detail(userId, request.id), (current) =>
        mergeRequestIntoDetail(current, request),
      );
      mergeOfferDetail(qc, userId, offer);
      void invalidateOfferGraph(qc, userId, { offerId: offer.id, requestId: request.id });
      void invalidateJobGraph(qc, userId, { jobId: job.id, requestId: request.id });
      void invalidateConversation(qc, userId, job.conversationId);
    },
  });
}
