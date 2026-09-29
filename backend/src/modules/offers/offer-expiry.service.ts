/**
 * Offer expiry (the mock scheduler's `expireOverdueOffers`, run by the `offer-expiry` cron): pending
 * offers past `expiresAt` expire one transaction each (idempotent: only a still-pending, overdue
 * offer changes), the request is recounted (`offers_received → open` when none are left) and the
 * professional is notified.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction } from '../../infra/mongo.js';
import { createNotification } from '../notifications/create-notification.service.js';
import { publishRequestUpdated } from '../requests/request-events.js';
import { syncRequestOfferCounters } from './offer-counters.service.js';
import { publishOfferUpdated } from './offer-events.js';
import { OfferModel, type OfferDoc } from './offer.model.js';

type ExpiryDeps = Pick<AppDeps, 'logger' | 'clock' | 'realtime' | 'push' | 'redis' | 'keys' | 'background'>;

const BATCH_SIZE = 100;
/** Bounds one run; a larger backlog is finished by the next runs. */
const MAX_BATCHES = 20;

/** Expires one overdue pending offer; `null` when it is no longer pending or not due. */
export function expireOffer(deps: ExpiryDeps, offerId: Types.ObjectId, now: Date): Promise<OfferDoc | null> {
  return withTransaction(deps.logger, async (tx) => {
    const expired = await OfferModel.findOneAndUpdate(
      { _id: offerId, status: 'pending', expiresAt: { $lte: now } },
      { $set: { status: 'expired', statusReason: 'expired' } },
      { session: tx.session, returnDocument: 'after' },
    ).lean<OfferDoc>();
    if (!expired) return null;
    const request = await syncRequestOfferCounters(expired.request, tx);
    await createNotification(deps, expired.professional, { type: 'offer_expired', offer: expired, categoryId: request.categoryId }, tx);
    await publishOfferUpdated(deps, expired, request.customer, tx);
    await publishRequestUpdated(deps, request, { tx });
    return expired;
  });
}

/** Returns how many offers expired. A failing offer is logged and skipped for this run. */
export async function expireOverdueOffers(deps: ExpiryDeps): Promise<number> {
  const now = deps.clock.now();
  const failed: Types.ObjectId[] = [];
  let expired = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const due = await OfferModel.find({ status: 'pending', expiresAt: { $lte: now }, _id: { $nin: failed } }, { _id: 1 })
      .sort({ expiresAt: 1 })
      .limit(BATCH_SIZE)
      .lean<{ _id: Types.ObjectId }[]>();
    for (const { _id } of due) {
      try {
        if (await expireOffer(deps, _id, now)) expired += 1;
      } catch (error) {
        failed.push(_id);
        deps.logger.error({ err: error, offerId: _id.toHexString() }, 'offer expiry failed');
      }
    }
    if (due.length < BATCH_SIZE) break;
  }
  if (expired > 0) deps.logger.info({ expired }, 'expired overdue offers');
  return expired;
}
