/**
 * `request.updated` realtime events (the mock's `emitRequestUpdated`): the owner and every
 * professional who sent an offer on the request; when the request enters or leaves the explorer,
 * also every matching professional (merged per professional: `explorer-events.ts`). Published
 * after commit inside a transaction.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { OfferModel } from '../offers/offer.model.js';
import { publishToExplorers } from './explorer-events.js';
import { findMatchingProfessionals, type MatchableRequest } from './matching.service.js';
import type { RequestDoc } from './request.model.js';

type ExplorerEventDeps = Pick<AppDeps, 'env' | 'realtime' | 'redis' | 'keys' | 'background' | 'logger'>;

/** The owner and the professionals with an offer on the request. */
async function requestAudience(request: Pick<RequestDoc, '_id' | 'customer'>, tx?: Tx): Promise<Set<string>> {
  const offering = await OfferModel.distinct('professional', { request: request._id }).session(tx?.session ?? null);
  return new Set<string>([request.customer.toHexString(), ...offering.map((id: Types.ObjectId) => id.toHexString())]);
}

export async function publishRequestUpdated(deps: Pick<AppDeps, 'realtime'>, request: Pick<RequestDoc, '_id' | 'customer'>, options: { tx?: Tx } = {}): Promise<void> {
  const audience = await requestAudience(request, options.tx);
  await publishEvent(deps.realtime, audience, { type: 'request.updated', requestId: request._id.toHexString() }, options.tx);
}

/**
 * `request.updated` for a request entering or leaving the explorers: at once to its own audience,
 * merged per window to the other matching professionals (`matchIds`). Outside transactions only.
 */
export async function publishExplorerChange(
  deps: ExplorerEventDeps,
  request: Pick<RequestDoc, '_id' | 'customer'>,
  matchIds: readonly Types.ObjectId[],
): Promise<void> {
  const requestId = request._id.toHexString();
  const audience = await requestAudience(request);
  await deps.realtime.publish([...audience], { type: 'request.updated', requestId });
  const explorers = matchIds.map((id) => id.toHexString()).filter((id) => !audience.has(id));
  await publishToExplorers(deps, requestId, explorers);
}

/**
 * A request leaves the explorers (accepted, cancelled). Its audience is computed once `tx`
 * committed, in the background: matching only reads professionals (category and location never
 * change), so it neither holds the transaction open nor delays the response.
 */
export function publishRequestLeftExplorers(
  deps: ExplorerEventDeps,
  request: Pick<RequestDoc, '_id' | 'customer'> & MatchableRequest,
  tx: Tx,
): void {
  tx.afterCommit(() => {
    deps.background.run('request-explorer-fan-out', async () => {
      const matches = await findMatchingProfessionals(request);
      await publishExplorerChange(deps, request, matches.map((match) => match.professionalId));
    });
  });
}
