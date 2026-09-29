/**
 * The professional's changes to their own pending offer (the mock's `updateOffer` /
 * `withdrawOffer`): edits restart the expiry from now; withdrawing recounts the request
 * (`offers_received → open` when it was the last pending one). The customer is notified.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { createNotification } from '../notifications/create-notification.service.js';
import { loadRequest, professionalNameOf } from '../requests/request-access.js';
import { publishRequestUpdated } from '../requests/request-events.js';
import { syncRequestOfferCounters } from './offer-counters.service.js';
import { publishOfferUpdated } from './offer-events.js';
import { assertOfferEditable, assertOfferTransition, assertProposedStart, assertSupportedCurrency, computeOfferExpiry } from './offer-rules.js';
import { OfferModel, type OfferDoc } from './offer.model.js';
import type { UpdateOfferInput } from './offers.schemas.js';

type ChangeDeps = Pick<AppDeps, 'logger' | 'clock' | 'realtime' | 'push' | 'redis' | 'keys' | 'background'>;

/** Missing → 404; another professional's offer → 403. */
export async function loadOwnOffer(auth: AuthContext, offerId: Types.ObjectId, tx: Tx): Promise<OfferDoc> {
  const offer = await OfferModel.findById(offerId).session(tx.session).lean<OfferDoc>();
  if (!offer) throw ApiError.notFound('Offer');
  if (!offer.professional.equals(auth.userId)) throw ApiError.forbidden('This offer belongs to another professional');
  return offer;
}

/** `PATCH /offers/:id` */
export function updateOffer(deps: ChangeDeps, auth: AuthContext, offerId: Types.ObjectId, input: UpdateOfferInput): Promise<OfferDoc> {
  return withTransaction(deps.logger, async (tx) => {
    const offer = await loadOwnOffer(auth, offerId, tx);
    const request = await loadRequest(offer.request, tx.session);
    const now = deps.clock.now();
    assertOfferEditable(offer, request.status, now);
    assertSupportedCurrency(input.currency);
    if (input.proposedStartAt !== undefined) assertProposedStart(input.proposedStartAt, request.urgency, now);
    const proposedStartAt = input.proposedStartAt ?? offer.proposedStartAt;
    const updated = await OfferModel.findOneAndUpdate(
      { _id: offer._id, status: 'pending' },
      {
        $set: {
          ...(input.price !== undefined ? { price: input.price } : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: input.estimatedDurationMinutes } : {}),
          ...(input.message !== undefined ? { message: input.message } : {}),
          proposedStartAt,
          expiresAt: computeOfferExpiry(request.urgency, proposedStartAt, now),
        },
      },
      { session: tx.session, returnDocument: 'after' },
    ).lean<OfferDoc>();
    if (!updated) throw ApiError.invalidTransition('offer', offer.status, 'pending');
    const professionalName = await professionalNameOf(offer.professional, tx.session);
    await createNotification(deps, request.customer, { type: 'offer_updated', offer: updated, categoryId: request.categoryId, professionalName }, tx);
    await publishOfferUpdated(deps, updated, request.customer, tx);
    await publishRequestUpdated(deps, request, { tx });
    return updated;
  });
}

/** `POST /offers/:id/withdraw` */
export function withdrawOffer(deps: ChangeDeps, auth: AuthContext, offerId: Types.ObjectId): Promise<OfferDoc> {
  return withTransaction(deps.logger, async (tx) => {
    const offer = await loadOwnOffer(auth, offerId, tx);
    if (offer.status === 'expired') throw ApiError.conflict('This offer has expired', 'OFFER_EXPIRED');
    assertOfferTransition(offer.status, 'withdrawn');
    const withdrawn = await OfferModel.findOneAndUpdate(
      { _id: offer._id, status: 'pending' },
      { $set: { status: 'withdrawn', statusReason: 'withdrawn_by_professional' } },
      { session: tx.session, returnDocument: 'after' },
    ).lean<OfferDoc>();
    if (!withdrawn) throw ApiError.invalidTransition('offer', offer.status, 'withdrawn');
    const request = await syncRequestOfferCounters(offer.request, tx);
    const professionalName = await professionalNameOf(offer.professional, tx.session);
    await createNotification(deps, request.customer, { type: 'offer_withdrawn', offer: withdrawn, categoryId: request.categoryId, professionalName }, tx);
    await publishOfferUpdated(deps, withdrawn, request.customer, tx);
    await publishRequestUpdated(deps, request, { tx });
    return withdrawn;
  });
}
