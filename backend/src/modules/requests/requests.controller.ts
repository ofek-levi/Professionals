/** Thin request controllers: validate → service → view. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { parseObjectId } from '../../lib/ids.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import type { CustomerRequestView, SuccessResponse } from '../../shared/contract/index.js';
import { listNearbyRequests } from './nearby.service.js';
import { cancelRequest } from './request-cancel.service.js';
import { createRequest, deleteDraftRequest, publishRequest, updateDraftRequest } from './request-lifecycle.service.js';
import { getRequestDetails, listCustomerRequests } from './request-queries.service.js';
import type { RequestDoc } from './request.model.js';
import {
  cancelRequestBody,
  createRequestBody,
  customerRequestsQuery,
  nearbyRequestsQuery,
  requestParams,
  updateDraftRequestBody,
} from './requests.schemas.js';
import { toCustomerRequestViews } from './requests.views.js';

const requestIdOf = (req: Request) => parseObjectId(validateRequest(req, { params: requestParams }).params.requestId, 'Request');

async function toCustomerView(request: RequestDoc): Promise<CustomerRequestView> {
  const [view] = await toCustomerRequestViews([request]);
  if (!view) throw ApiError.notFound('Request');
  return view;
}

/** `POST /v1/requests` → 201 `CustomerRequestView` */
export const create = (deps: AppDeps) => async (req: Request) => {
  const { body } = validateRequest(req, { body: createRequestBody });
  return toCustomerView(await createRequest(deps, authOf(req, 'customer'), body));
};

/** `GET /v1/requests/:requestId` → `RequestDetailsResponse` (role-aware) */
export const getDetails = () => (req: Request) => getRequestDetails(authOf(req), requestIdOf(req));

/** `PATCH /v1/requests/:requestId` (drafts) → `CustomerRequestView` */
export const updateDraft = (deps: AppDeps) => async (req: Request) => {
  const { params, body } = validateRequest(req, { params: requestParams, body: updateDraftRequestBody });
  const requestId = parseObjectId(params.requestId, 'Request');
  return toCustomerView(await updateDraftRequest(deps, authOf(req, 'customer'), requestId, body));
};

/** `DELETE /v1/requests/:requestId` (drafts) → `{ success: true }` */
export const deleteDraft = (deps: AppDeps) => async (req: Request): Promise<SuccessResponse> => {
  await deleteDraftRequest(deps, authOf(req, 'customer'), requestIdOf(req));
  return { success: true };
};

/** `POST /v1/requests/:requestId/publish` → `CustomerRequestView` */
export const publish = (deps: AppDeps) => async (req: Request) =>
  toCustomerView(await publishRequest(deps, authOf(req, 'customer'), requestIdOf(req)));

/** `POST /v1/requests/:requestId/cancel` → `CustomerRequestView` */
export const cancel = (deps: AppDeps) => async (req: Request) => {
  const { params, body } = validateRequest(req, { params: requestParams, body: cancelRequestBody });
  const requestId = parseObjectId(params.requestId, 'Request');
  return toCustomerView(await cancelRequest(deps, authOf(req, 'customer'), requestId, body));
};

/** `GET /v1/customer/requests?section=&statuses=&cursor=&limit=` → `Paginated<CustomerRequestView>` */
export const listMine = () => (req: Request) => {
  const { query } = validateRequest(req, { query: customerRequestsQuery });
  return listCustomerRequests(authOf(req, 'customer'), query);
};

/** `GET /v1/professional/requests/nearby?…` → `Paginated<ProfessionalRequestView>` */
export const listNearby = () => (req: Request) => {
  const { query } = validateRequest(req, { query: nearbyRequestsQuery });
  return listNearbyRequests(authOf(req, 'professional'), query);
};
