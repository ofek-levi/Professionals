/** Request reads: `GET /requests/:id` (role-aware) and `GET /customer/requests`. */
import type { QueryFilter, Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { findPage, RECENTLY_UPDATED } from '../../lib/pagination.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CustomerRequestView, Paginated, RequestDetailsResponse } from '../../shared/contract/index.js';
import { hasOfferOn } from '../offers/offer-lookups.js';
import { isRequestMatch, loadMatchableProfessional } from './matching.service.js';
import { loadRequest } from './request-access.js';
import { sectionFilter } from './request-rules.js';
import { RequestModel, type RequestDoc } from './request.model.js';
import type { CustomerRequestsQuery } from './requests.schemas.js';
import { toCustomerRequestViews, toProfessionalRequestViews } from './requests.views.js';

/**
 * The owner gets the full view; a professional gets the redacted one when the request matches
 * their services or they sent an offer on it (drafts do not exist for them).
 */
export async function getRequestDetails(auth: AuthContext, requestId: Types.ObjectId): Promise<RequestDetailsResponse> {
  const request = await loadRequest(requestId);
  if (auth.role === 'customer') {
    if (!request.customer.equals(auth.userId)) throw ApiError.forbidden('This request belongs to another customer');
    const [view] = await toCustomerRequestViews([request]);
    if (!view) throw ApiError.notFound('Request');
    return { viewerRole: 'customer', request: view };
  }
  if (request.status === 'draft') throw ApiError.notFound('Request');
  const [professional, offered] = await Promise.all([loadMatchableProfessional(auth.userId), hasOfferOn(request._id, auth.userId)]);
  if (!offered && !isRequestMatch(request, professional)) {
    throw ApiError.forbidden('This request does not match your services or service area');
  }
  const [view] = await toProfessionalRequestViews([request], professional);
  if (!view) throw ApiError.notFound('Request');
  return { viewerRole: 'professional', request: view };
}

/** "My requests": most recently updated first, optionally one section and/or statuses. */
export async function listCustomerRequests(auth: AuthContext, query: CustomerRequestsQuery): Promise<Paginated<CustomerRequestView>> {
  const clauses: QueryFilter<RequestDoc>[] = [{ customer: auth.userId }];
  if (query.section) clauses.push(sectionFilter(query.section));
  if (query.statuses) clauses.push({ status: { $in: query.statuses } });
  const page = await findPage<RequestDoc, RequestDoc>(RequestModel, {
    filter: clauses.length === 1 ? { customer: auth.userId } : { $and: clauses },
    sort: RECENTLY_UPDATED,
    page: { cursor: query.cursor, limit: query.limit },
  });
  return { ...page, items: await toCustomerRequestViews(page.items) };
}
