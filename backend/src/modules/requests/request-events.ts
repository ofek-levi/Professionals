/**
 * `request.updated` realtime events (the mock's `emitRequestUpdated`): the owner, every
 * professional who sent an offer on the request, plus any extra audience (the explorer of matching
 * professionals when the request enters or leaves it). Published after commit inside a transaction.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { OfferModel } from '../offers/offer.model.js';
import type { RequestDoc } from './request.model.js';

export async function publishRequestUpdated(
  deps: Pick<AppDeps, 'realtime'>,
  request: Pick<RequestDoc, '_id' | 'customer'>,
  options: { extra?: Iterable<Types.ObjectId>; tx?: Tx } = {},
): Promise<void> {
  const offering = await OfferModel.distinct('professional', { request: request._id }).session(options.tx?.session ?? null);
  const audience = new Set<string>([request.customer.toHexString()]);
  for (const id of [...offering, ...(options.extra ?? [])]) audience.add(id.toHexString());
  await publishEvent(deps.realtime, audience, { type: 'request.updated', requestId: request._id.toHexString() }, options.tx);
}
