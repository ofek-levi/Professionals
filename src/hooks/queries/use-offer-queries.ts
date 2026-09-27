import { keepPreviousData, skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { ProfessionalOffersParams, RequestOffersParams } from '@/types/api';
import type { OfferWithProfessional, OfferWithRequest } from '@/types/domain';

import { queryKeys } from './query-keys';
import {
  DEFAULT_PAGE_SIZE,
  getNextPageParam,
  INITIAL_PAGE_PARAM,
  selectPaginatedList,
  useQueryScope,
} from './query-scope';

/** `GET /offers/:id` payload: the offer with the professional summary and the request. */
export type OfferDetails = OfferWithProfessional & Pick<OfferWithRequest, 'request'>;

export type ProfessionalOffersQueryParams = Omit<ProfessionalOffersParams, 'cursor'>;

/**
 * `GET /requests/:id/offers` – offers on the customer's request, sorted server-side. Keeps the
 * previous list while a new sort/filter loads.
 */
export function useRequestOffers(requestId: string | null | undefined, params: RequestOffersParams = {}) {
  const { userId, enabled } = useQueryScope('customer');
  return useQuery({
    queryKey: queryKeys.offers.forRequest(userId, requestId ?? '', params),
    queryFn: enabled && requestId ? ({ signal }) => api.offers.getOffersForRequest(requestId, params, signal) : skipToken,
    placeholderData: keepPreviousData,
  });
}

/** `GET /offers/:id` – for the request owner or the offering professional. */
export function useOffer(offerId: string | null | undefined) {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.offers.detail(userId, offerId ?? ''),
    queryFn: enabled && offerId ? ({ signal }): Promise<OfferDetails> => api.offers.getOfferById(offerId, signal) : skipToken,
  });
}

/** `GET /professional/offers` – the professional's offers, infinite (professionals only). */
export function useProfessionalOffers(params: ProfessionalOffersQueryParams = {}) {
  const { userId, enabled } = useQueryScope('professional');
  const filters: ProfessionalOffersQueryParams = { ...params, limit: params.limit ?? DEFAULT_PAGE_SIZE };
  return useInfiniteQuery({
    queryKey: queryKeys.offers.professionalList(userId, filters),
    queryFn: ({ pageParam, signal }) => api.offers.getProfessionalOffers({ ...filters, cursor: pageParam }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectPaginatedList,
    enabled,
  });
}
