import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import { useQueryScope } from '@/hooks/queries/query-scope';
import { api } from '@/services/api';
import type { CancelRequestPayload, CreateServiceRequestPayload, LocalImage, RequestDetailsResponse, UpdateDraftRequestPayload } from '@/types/api';
import type { CustomerRequestView } from '@/types/domain';

import { invalidateJobGraph, invalidateRequestGraph } from './invalidation';

/** Seeds the request detail cache with a fresh server response (instant detail screens). */
function seedCustomerRequest(qc: QueryClient, userId: string | null, request: CustomerRequestView): void {
  qc.setQueryData<RequestDetailsResponse>(queryKeys.requests.detail(userId, request.id), { viewerRole: 'customer', request });
}

interface CreateRequestVariables {
  payload: CreateServiceRequestPayload;
  /** Sent with the request (multipart). */
  photos?: readonly LocalImage[];
}

/** `POST /requests` – create (and by default publish) a request with its photos. `payload.publish: false` saves a draft. */
export function useCreateRequest() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: ({ payload, photos }: CreateRequestVariables) => api.requests.createRequest(payload, photos),
    onSuccess: (request) => {
      seedCustomerRequest(qc, userId, request);
      void invalidateRequestGraph(qc, userId, request.id);
      void qc.invalidateQueries({ queryKey: queryKeys.customer.profile(userId) });
    },
  });
}

interface UpdateDraftRequestVariables {
  requestId: string;
  payload: UpdateDraftRequestPayload;
  /** New photos, added after `payload.keepPhotos`. */
  photos?: readonly LocalImage[];
}

/** `PATCH /requests/:id` – edit a draft (its fields and photos). */
export function useUpdateDraftRequest() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: ({ requestId, payload, photos }: UpdateDraftRequestVariables) => api.requests.updateDraftRequest(requestId, payload, photos),
    onSuccess: (request) => {
      seedCustomerRequest(qc, userId, request);
      void invalidateRequestGraph(qc, userId, request.id);
    },
  });
}

/** `POST /requests/:id/publish` – publish a draft (matching pros get notified). */
export function usePublishRequest() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: (requestId: string) => api.requests.publishRequest(requestId),
    onSuccess: (request) => {
      seedCustomerRequest(qc, userId, request);
      void invalidateRequestGraph(qc, userId, request.id);
    },
  });
}

interface CancelRequestVariables {
  requestId: string;
  payload: CancelRequestPayload;
}

/** `POST /requests/:id/cancel` – also cancels a scheduled job and rejects pending offers. */
export function useCancelRequest() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: ({ requestId, payload }: CancelRequestVariables) => api.requests.cancelRequest(requestId, payload),
    onSuccess: (request) => {
      seedCustomerRequest(qc, userId, request);
      void invalidateRequestGraph(qc, userId, request.id);
      void invalidateJobGraph(qc, userId, { jobId: request.jobId, requestId: request.id });
    },
  });
}

/** `DELETE /requests/:id` – delete a draft. */
export function useDeleteDraftRequest() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  return useMutation({
    mutationFn: (requestId: string) => api.requests.deleteDraftRequest(requestId),
    onSuccess: (_result, requestId) => {
      qc.removeQueries({ queryKey: queryKeys.requests.detail(userId, requestId), exact: true });
      void invalidateRequestGraph(qc, userId);
      void qc.invalidateQueries({ queryKey: queryKeys.customer.profile(userId) });
    },
  });
}
