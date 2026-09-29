import type { Types } from 'mongoose';

import type { RealtimeEvent } from '../../shared/contract/index.js';
import type { Tx } from '../mongo.js';
import type { RealtimePublisher } from './publisher.js';

/**
 * Publishes `event` to `userIds` — after the commit when called inside a transaction, so clients
 * never refetch data that is not visible yet.
 */
export async function publishEvent(
  realtime: RealtimePublisher,
  userIds: Iterable<string | Types.ObjectId>,
  event: RealtimeEvent,
  tx?: Tx,
): Promise<void> {
  const ids = [...userIds].map((id) => (typeof id === 'string' ? id : id.toHexString()));
  if (tx) tx.afterCommit(() => realtime.publish(ids, event));
  else await realtime.publish(ids, event);
}
