/** `/offers/*` and `/professional/offers` routes. */
import { OFFER_STATUSES } from '@/constants/offer-statuses';
import { DomainError } from '@/features/shared/domain-error';
import type { OfferWithProfessional, OfferWithRequest } from '@/types/domain';

import type { Actor } from '../auth';
import type { ServerContext } from '../context';
import { paginate } from '../pagination';
import { requireOffer, requireRequest } from '../queries';
import { route } from '../router';
import { acceptOffer, updateOffer, withdrawOffer } from '../services/lifecycle-service';
import { toOfferRequestSummary, toOfferWithProfessional, toOfferWithRequest } from '../views';
import { paginationFrom } from './shared';

type OfferDetails = OfferWithProfessional & Pick<OfferWithRequest, 'request'>;

function offerDetails(ctx: ServerContext, actor: Actor, offerId: string): OfferDetails {
  const offer = requireOffer(ctx.db, offerId);
  const request = requireRequest(ctx.db, offer.requestId);
  const allowed =
    actor.role === 'customer' ? request.customerId === actor.userId : offer.professionalId === actor.professional.id;
  if (!allowed) throw DomainError.forbidden('You cannot view this offer');
  return { ...toOfferWithProfessional(ctx, offer, request), request: toOfferRequestSummary(ctx, request, actor) };
}

export const offerRoutes = [
  route({ method: 'GET', path: '/offers/:offerId', auth: 'user', handler: ({ ctx, actor, params }) => offerDetails(ctx, actor, params.offerId) }),
  route({
    method: 'PATCH',
    path: '/offers/:offerId',
    auth: 'professional',
    handler: ({ ctx, actor, params, body }) => updateOffer(ctx, actor, params.offerId, body),
  }),
  route({
    method: 'POST',
    path: '/offers/:offerId/withdraw',
    auth: 'professional',
    handler: ({ ctx, actor, params }) => withdrawOffer(ctx, actor, params.offerId),
  }),
  route({
    method: 'POST',
    path: '/offers/:offerId/accept',
    auth: 'customer',
    handler: ({ ctx, actor, params }) => acceptOffer(ctx, actor, params.offerId),
  }),
  route({
    method: 'GET',
    path: '/professional/offers',
    auth: 'professional',
    handler: ({ ctx, actor, query }) => {
      const statuses = query.enumList('statuses', OFFER_STATUSES);
      const offers = ctx.db.offers
        .filter((offer) => offer.professionalId === actor.professional.id && (!statuses || statuses.includes(offer.status)))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || b.id.localeCompare(a.id));
      const page = paginate(offers, paginationFrom(query));
      return { ...page, items: page.items.map((offer) => toOfferWithRequest(ctx, offer, actor)) };
    },
  }),
];
