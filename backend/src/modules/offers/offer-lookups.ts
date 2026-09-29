/** Small offer lookups shared with the requests and dashboard modules. */
import type { Types } from 'mongoose';

import { ACTIVE_OFFER_STATUSES } from '../../shared/statuses.js';
import { OfferModel } from './offer.model.js';

/** Requests on which the professional has an active (pending/accepted) offer. */
export async function activeOfferRequestIds(professionalId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const offers = await OfferModel.find({ professional: professionalId, status: { $in: [...ACTIVE_OFFER_STATUSES] } }, { request: 1, _id: 0 }).lean<
    { request: Types.ObjectId }[]
  >();
  return offers.map((offer) => offer.request);
}

/** Whether the professional ever sent an offer on the request (any status). */
export async function hasOfferOn(requestId: Types.ObjectId, professionalId: Types.ObjectId): Promise<boolean> {
  return (await OfferModel.exists({ request: requestId, professional: professionalId })) !== null;
}
