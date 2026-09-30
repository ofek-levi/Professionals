import type {
  AcceptOfferResponse,
  CreateOfferPayload,
  Paginated,
  ProfessionalOffersParams,
  RequestOffersParams,
  UpdateOfferPayload,
} from '@/types/api';
import type { Offer, OfferWithProfessional, OfferWithRequest } from '@/types/domain';
import type { ApiClient } from '../client';

const id = (value: string) => encodeURIComponent(value);

export function createOffersApi(client: ApiClient) {
  return {
    /** `GET /requests/:id/offers` (customer who owns the request) – ranked, cursor paginated. */
    getOffersForRequest: (requestId: string, params: RequestOffersParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<OfferWithProfessional>>(`/requests/${id(requestId)}/offers`, {
        signal,
        query: { sort: params.sort, statuses: params.statuses, cursor: params.cursor, limit: params.limit },
      }),

    /** `GET /offers/:id` (customer owner of the request or the offering professional) */
    getOfferById: (offerId: string, signal?: AbortSignal) =>
      client.get<OfferWithProfessional & Pick<OfferWithRequest, 'request'>>(`/offers/${id(offerId)}`, { signal }),

    /** `POST /requests/:id/offers` (professional) */
    createOffer: (requestId: string, payload: CreateOfferPayload) =>
      client.post<Offer>(`/requests/${id(requestId)}/offers`, payload),

    /** `PATCH /offers/:id` (professional, pending offers only) */
    updateOffer: (offerId: string, payload: UpdateOfferPayload) => client.patch<Offer>(`/offers/${id(offerId)}`, payload),

    /** `POST /offers/:id/withdraw` (professional) */
    withdrawOffer: (offerId: string) => client.post<Offer>(`/offers/${id(offerId)}/withdraw`),

    /** `POST /offers/:id/accept` (customer) – atomically accepts one offer and rejects the rest. */
    acceptOffer: (offerId: string) => client.post<AcceptOfferResponse>(`/offers/${id(offerId)}/accept`),

    /** `GET /professional/offers` */
    getProfessionalOffers: (params: ProfessionalOffersParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<OfferWithRequest>>('/professional/offers', {
        signal,
        query: { statuses: params.statuses, cursor: params.cursor, limit: params.limit },
      }),
  };
}
