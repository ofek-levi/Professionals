/**
 * Offer aggregates of a request (the app's `features/offers/offer-counters.ts`): the denormalized
 * `offerCount`/`pendingOfferCount` on the request (with the `open ⇄ offers_received` flip), the
 * cascade that rejects pending offers, and the per-request stats of customer views.
 */
import type { Types } from 'mongoose';

import type { Tx } from '../../infra/mongo.js';
import type { OfferStatusReason } from '../../shared/statuses.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { assertRequestTransition, requestStatusForPendingOffers } from '../requests/request-rules.js';
import { OfferModel, type OfferDoc } from './offer.model.js';

interface OfferCounts {
  /** Offers not withdrawn (`ServiceRequest.offerCount`). */
  offerCount: number;
  /** Offers awaiting the customer's decision. */
  pendingOfferCount: number;
}

async function countOffers(requestId: Types.ObjectId, tx: Tx): Promise<OfferCounts> {
  const [row] = await OfferModel.aggregate<OfferCounts>([
    { $match: { request: requestId } },
    {
      $group: {
        _id: null,
        offerCount: { $sum: { $cond: [{ $ne: ['$status', 'withdrawn'] }, 1, 0] } },
        pendingOfferCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
      },
    },
  ]).session(tx.session);
  return { offerCount: row?.offerCount ?? 0, pendingOfferCount: row?.pendingOfferCount ?? 0 };
}

/** Fields a lifecycle step changes together with the counters (acceptance, cancellation). */
export type RequestChange = Partial<
  Pick<RequestDoc, 'status' | 'acceptedOffer' | 'job' | 'cancelledAt' | 'cancellationReason' | 'cancellationComment' | 'photos'>
>;

/**
 * Recounts the request's offers from the source rows (never incremented, so they cannot drift)
 * and flips `open ⇄ offers_received` (unless `change.status` sets the status; the caller checked
 * that transition). The write also makes the request the conflict point of concurrent offer
 * changes and acceptance inside transactions. Returns the updated request.
 */
export async function syncRequestOfferCounters(requestId: Types.ObjectId, tx: Tx, change: RequestChange = {}): Promise<RequestDoc> {
  const counts = await countOffers(requestId, tx);
  const request = await RequestModel.findById(requestId, { status: 1 }).session(tx.session).lean<Pick<RequestDoc, '_id' | 'status'>>();
  if (!request) throw new Error(`Request ${requestId.toHexString()} is missing`);
  const status = change.status ?? requestStatusForPendingOffers(request.status, counts.pendingOfferCount);
  if (status !== request.status) assertRequestTransition(request.status, status);
  const updated = await RequestModel.findOneAndUpdate(
    { _id: requestId },
    { $set: { ...change, ...counts, status } },
    { session: tx.session, returnDocument: 'after' },
  ).lean<RequestDoc>();
  if (!updated) throw new Error(`Request ${requestId.toHexString()} is missing`);
  return updated;
}

/** Rejects every pending offer of the request (acceptance of another one, cancellation). */
export async function rejectPendingOffers(
  requestId: Types.ObjectId,
  reason: Extract<OfferStatusReason, 'another_offer_accepted' | 'request_cancelled'>,
  now: Date,
  tx: Tx,
): Promise<OfferDoc[]> {
  const pending = await OfferModel.find({ request: requestId, status: 'pending' }).session(tx.session).lean<OfferDoc[]>();
  if (pending.length === 0) return [];
  const change = { status: 'rejected' as const, statusReason: reason, respondedAt: now, updatedAt: now };
  await OfferModel.updateMany(
    { _id: { $in: pending.map((offer) => offer._id) }, status: 'pending' },
    { $set: change },
    { session: tx.session, timestamps: false },
  );
  return pending.map((offer) => ({ ...offer, ...change }));
}

export interface RequestOfferStats {
  /** Newest pending offer (`CustomerRequestView.latestOfferAt`). */
  latestOfferAt: Date | null;
  /** Lowest pending/accepted price (`CustomerRequestView.lowestOfferPrice`). */
  lowestOfferPrice: number | null;
}

/** Stats of a page of requests in one aggregation (`{request, createdAt}` index). */
export async function loadRequestOfferStats(requestIds: readonly Types.ObjectId[]): Promise<Map<string, RequestOfferStats>> {
  if (requestIds.length === 0) return new Map();
  const rows = await OfferModel.aggregate<RequestOfferStats & { _id: Types.ObjectId }>([
    { $match: { request: { $in: requestIds } } },
    {
      $group: {
        _id: '$request',
        // `$max`/`$min` skip nulls, so non-qualifying offers do not count.
        latestOfferAt: { $max: { $cond: [{ $eq: ['$status', 'pending'] }, '$createdAt', null] } },
        lowestOfferPrice: { $min: { $cond: [{ $in: ['$status', ['pending', 'accepted']] }, '$price', null] } },
      },
    },
  ]);
  return new Map(rows.map(({ _id, ...stats }) => [_id.toHexString(), stats]));
}
