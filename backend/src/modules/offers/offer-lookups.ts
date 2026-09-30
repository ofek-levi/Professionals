/** Small offer lookups shared with the requests and dashboard modules. */
import type { Types } from 'mongoose';

import { OfferModel } from './offer.model.js';

/**
 * Requests on which the professional has a pending offer (the explorer's "sent an offer" set).
 * Accepted offers are left out on purpose: their request left `open`/`offers_received` for good,
 * so it can never be in the explorer again, and the list would grow with every job ever won.
 */
export async function pendingOfferRequestIds(professionalId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const offers = await OfferModel.find({ professional: professionalId, status: 'pending' }, { request: 1, _id: 0 }).lean<{ request: Types.ObjectId }[]>();
  return offers.map((offer) => offer.request);
}

/** Whether the professional ever sent an offer on the request (any status). */
export async function hasOfferOn(requestId: Types.ObjectId, professionalId: Types.ObjectId): Promise<boolean> {
  return (await OfferModel.exists({ request: requestId, professional: professionalId })) !== null;
}
