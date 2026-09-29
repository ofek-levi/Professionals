/** Thin offer controllers: validate → service → view. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { parseObjectId } from '../../lib/ids.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import type { AcceptOfferResponse } from '../../shared/contract/index.js';
import { toJobDto } from '../jobs/jobs.views.js';
import { toServiceRequestDto } from '../requests/requests.views.js';
import { acceptOffer } from './accept-offer.service.js';
import { updateOffer, withdrawOffer } from './offer-changes.service.js';
import { getOfferDetails, listProfessionalOffers, listRequestOffers } from './offer-queries.service.js';
import {
  createOfferBody,
  offerParams,
  professionalOffersQuery,
  requestOffersParams,
  requestOffersQuery,
  updateOfferBody,
} from './offers.schemas.js';
import { toOfferDto } from './offers.views.js';
import { submitOffer } from './submit-offer.service.js';

const offerIdOf = (req: Request) => parseObjectId(validateRequest(req, { params: offerParams }).params.offerId, 'Offer');

/** `POST /v1/requests/:requestId/offers` → 201 `Offer` */
export const submit = (deps: AppDeps) => async (req: Request) => {
  const { params, body } = validateRequest(req, { params: requestOffersParams, body: createOfferBody });
  const requestId = parseObjectId(params.requestId, 'Request');
  return toOfferDto(await submitOffer(deps, authOf(req, 'professional'), requestId, body));
};

/** `GET /v1/requests/:requestId/offers?sort=&statuses=&cursor=&limit=` → `Paginated<OfferWithProfessional>` */
export const listForRequest = () => (req: Request) => {
  const { params, query } = validateRequest(req, { params: requestOffersParams, query: requestOffersQuery });
  return listRequestOffers(authOf(req, 'customer'), parseObjectId(params.requestId, 'Request'), query);
};

/** `GET /v1/offers/:offerId` → `OfferDetails` */
export const getDetails = () => (req: Request) => getOfferDetails(authOf(req), offerIdOf(req));

/** `PATCH /v1/offers/:offerId` → `Offer` */
export const update = (deps: AppDeps) => async (req: Request) => {
  const { params, body } = validateRequest(req, { params: offerParams, body: updateOfferBody });
  return toOfferDto(await updateOffer(deps, authOf(req, 'professional'), parseObjectId(params.offerId, 'Offer'), body));
};

/** `POST /v1/offers/:offerId/withdraw` → `Offer` */
export const withdraw = (deps: AppDeps) => async (req: Request) =>
  toOfferDto(await withdrawOffer(deps, authOf(req, 'professional'), offerIdOf(req)));

/** `POST /v1/offers/:offerId/accept` → `AcceptOfferResponse` */
export const accept = (deps: AppDeps) => async (req: Request): Promise<AcceptOfferResponse> => {
  const result = await acceptOffer(deps, authOf(req, 'customer'), offerIdOf(req));
  return { offer: toOfferDto(result.offer), request: toServiceRequestDto(result.request), job: toJobDto(result.job, result.request) };
};

/** `GET /v1/professional/offers?statuses=&cursor=&limit=` → `Paginated<OfferWithRequest>` */
export const listMine = () => (req: Request) => {
  const { query } = validateRequest(req, { query: professionalOffersQuery });
  return listProfessionalOffers(authOf(req, 'professional'), query);
};
