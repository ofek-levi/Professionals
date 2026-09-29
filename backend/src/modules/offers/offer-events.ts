/** `offer.updated` realtime events: the request's owner and the offering professional. */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import type { OfferDoc } from './offer.model.js';

export async function publishOfferUpdated(
  deps: Pick<AppDeps, 'realtime'>,
  offer: Pick<OfferDoc, '_id' | 'request' | 'professional'>,
  customerId: Types.ObjectId,
  tx?: Tx,
): Promise<void> {
  const event = { type: 'offer.updated', offerId: offer._id.toHexString(), requestId: offer.request.toHexString() } as const;
  await publishEvent(deps.realtime, [customerId, offer.professional], event, tx);
}
