import type {
  CancelRequestPayload,
  CreateServiceRequestPayload,
  CustomerRequestsParams,
  NearbyRequestsParams,
  Paginated,
  RequestDetailsResponse,
  SuccessResponse,
  UpdateDraftRequestPayload,
} from '@/types/api';
import type { CustomerRequestView, ProfessionalRequestView, ServiceRequest } from '@/types/domain';
import type { ApiClient } from '../client';

const id = (value: string) => encodeURIComponent(value);

export function createRequestsApi(client: ApiClient) {
  return {
    /** `POST /requests` (customer) */
    createRequest: (payload: CreateServiceRequestPayload) => client.post<CustomerRequestView>('/requests', payload),

    /** `GET /requests/:id` – role aware (professionals receive a redacted view). */
    getRequestById: (requestId: string, signal?: AbortSignal) =>
      client.get<RequestDetailsResponse>(`/requests/${id(requestId)}`, { signal }),

    /** `PATCH /requests/:id` (customer, drafts only) */
    updateDraftRequest: (requestId: string, payload: UpdateDraftRequestPayload) =>
      client.patch<CustomerRequestView>(`/requests/${id(requestId)}`, payload),

    /** `POST /requests/:id/publish` (customer) */
    publishRequest: (requestId: string) => client.post<CustomerRequestView>(`/requests/${id(requestId)}/publish`),

    /** `POST /requests/:id/cancel` (customer) */
    cancelRequest: (requestId: string, payload: CancelRequestPayload) =>
      client.post<CustomerRequestView>(`/requests/${id(requestId)}/cancel`, payload),

    /** `DELETE /requests/:id` (customer, drafts only) */
    deleteDraftRequest: (requestId: string) => client.delete<SuccessResponse>(`/requests/${id(requestId)}`),

    /** `GET /customer/requests` */
    getCustomerRequests: (params: CustomerRequestsParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<CustomerRequestView>>('/customer/requests', {
        signal,
        query: { section: params.section, statuses: params.statuses, cursor: params.cursor, limit: params.limit },
      }),

    /** `GET /professional/requests/nearby` – open requests matching the professional's categories & area. */
    getNearbyOpenRequests: (params: NearbyRequestsParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<ProfessionalRequestView>>('/professional/requests/nearby', {
        signal,
        query: {
          categoryIds: params.categoryIds,
          maxDistanceKm: params.maxDistanceKm,
          urgencies: params.urgencies,
          preferredDateFrom: params.preferredDateFrom,
          preferredDateTo: params.preferredDateTo,
          offerPresence: params.offerPresence,
          excludeWithMyOffer: params.excludeWithMyOffer,
          sort: params.sort,
          cursor: params.cursor,
          limit: params.limit,
        },
      }),
  };
}

export type { ServiceRequest };
