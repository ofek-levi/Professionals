/** `/requests/*` routes. */
import { OFFER_STATUSES } from '@/constants/offer-statuses';
import { sortOffers } from '@/features/offers/offer-sorting';
import { isRequestMatchForProfessional } from '@/features/requests/request-matching';
import { DomainError } from '@/features/shared/domain-error';
import { OFFER_SORTS, type RequestDetailsResponse } from '@/types/api';

import type { Actor } from '../auth';
import type { ServerContext } from '../context';
import { offersForRequest, requireProfessional, requireRequest } from '../queries';
import { created, route } from '../router';
import {
  cancelRequest,
  createRequest,
  deleteDraftRequest,
  publishRequest,
  submitOffer,
  updateDraftRequest,
} from '../services/lifecycle-service';
import { toCustomerRequestView, toOfferWithProfessional, toProfessionalRequestView } from '../views';
import { SUCCESS } from './shared';

/** Owner customers get the full view; matching or offering professionals get a redacted one. */
function requestDetails(ctx: ServerContext, actor: Actor, requestId: string): RequestDetailsResponse {
  const request = requireRequest(ctx.db, requestId);
  if (actor.role === 'customer') {
    if (request.customerId !== actor.userId) throw DomainError.forbidden('This request belongs to another customer');
    return { viewerRole: 'customer', request: toCustomerRequestView(ctx, request) };
  }
  if (request.status === 'draft') throw DomainError.notFound('Request', requestId);
  const professional = requireProfessional(ctx.db, actor.professional.id);
  const hasOffer = ctx.db.offers.find((offer) => offer.requestId === request.id && offer.professionalId === professional.id);
  if (!hasOffer && !isRequestMatchForProfessional(request, professional)) {
    throw DomainError.forbidden('This request does not match your services or service area');
  }
  return { viewerRole: 'professional', request: toProfessionalRequestView(ctx, request, professional) };
}

export const requestRoutes = [
  route({
    method: 'POST',
    path: '/requests',
    auth: 'customer',
    handler: ({ ctx, actor, body }) => created(toCustomerRequestView(ctx, createRequest(ctx, actor, body))),
  }),
  route({
    method: 'GET',
    path: '/requests/:requestId',
    auth: 'user',
    handler: ({ ctx, actor, params }) => requestDetails(ctx, actor, params.requestId),
  }),
  route({
    method: 'PATCH',
    path: '/requests/:requestId',
    auth: 'customer',
    handler: ({ ctx, actor, params, body }) => toCustomerRequestView(ctx, updateDraftRequest(ctx, actor, params.requestId, body)),
  }),
  route({
    method: 'DELETE',
    path: '/requests/:requestId',
    auth: 'customer',
    handler: ({ ctx, actor, params }) => {
      deleteDraftRequest(ctx, actor, params.requestId);
      return SUCCESS;
    },
  }),
  route({
    method: 'POST',
    path: '/requests/:requestId/publish',
    auth: 'customer',
    handler: ({ ctx, actor, params }) => toCustomerRequestView(ctx, publishRequest(ctx, actor, params.requestId)),
  }),
  route({
    method: 'POST',
    path: '/requests/:requestId/cancel',
    auth: 'customer',
    handler: ({ ctx, actor, params, body }) => toCustomerRequestView(ctx, cancelRequest(ctx, actor, params.requestId, body)),
  }),
  route({
    method: 'GET',
    path: '/requests/:requestId/offers',
    auth: 'customer',
    handler: ({ ctx, actor, params, query }) => {
      const request = requireRequest(ctx.db, params.requestId);
      if (request.customerId !== actor.userId) throw DomainError.forbidden('This request belongs to another customer');
      const statuses = query.enumList('statuses', OFFER_STATUSES);
      const sort = query.enumValue('sort', OFFER_SORTS) ?? 'recommended';
      const offers = offersForRequest(ctx.db, request.id)
        .filter((offer) => !statuses || statuses.includes(offer.status))
        .map((offer) => toOfferWithProfessional(ctx, offer, request));
      return sortOffers(offers, sort);
    },
  }),
  route({
    method: 'POST',
    path: '/requests/:requestId/offers',
    auth: 'professional',
    handler: ({ ctx, actor, params, body }) => created(submitOffer(ctx, actor, params.requestId, body)),
  }),
];
