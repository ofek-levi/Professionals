/**
 * Expo push tickets waiting for their receipt, kept in a Redis sorted set scored by send time.
 * The receipts cron reads them, deletes tokens reported `DeviceNotRegistered` and drops entries
 * once answered or older than a day (Expo keeps receipts for 24 h).
 */
import { KEY_SPACES, type RedisKeys } from '../../infra/keys.js';
import type { Redis } from '../../infra/redis.js';
import { API_LIMITS } from '../../shared/limits.js';

export interface PendingTicket {
  ticketId: string;
  token: string;
}

const SEPARATOR = '|';

const setKey = (keys: RedisKeys) => keys.key(KEY_SPACES.pushTickets);
const member = (ticket: PendingTicket) => `${ticket.ticketId}${SEPARATOR}${ticket.token}`;

export async function savePushTickets(redis: Redis, keys: RedisKeys, tickets: PendingTicket[], now: Date): Promise<void> {
  if (tickets.length === 0) return;
  const score = now.getTime();
  await redis.zadd(setKey(keys), ...tickets.flatMap((ticket) => [score, member(ticket)]));
}

/** Drops tickets older than the receipt lifetime (their receipts are gone). */
export async function purgeExpiredPushTickets(redis: Redis, keys: RedisKeys, now: Date): Promise<void> {
  await redis.zremrangebyscore(setKey(keys), '-inf', now.getTime() - API_LIMITS.pushTicketTtlSeconds * 1000);
}

/** Oldest tickets sent before `sentBefore` (receipts are ready ~15 min after sending). */
export async function duePushTickets(
  redis: Redis,
  keys: RedisKeys,
  sentBefore: Date,
  page: { offset: number; limit: number } = { offset: 0, limit: 1000 },
): Promise<PendingTicket[]> {
  const members = await redis.zrangebyscore(setKey(keys), '-inf', sentBefore.getTime(), 'LIMIT', page.offset, page.limit);
  return members.flatMap((value) => {
    const index = value.indexOf(SEPARATOR);
    return index > 0 ? [{ ticketId: value.slice(0, index), token: value.slice(index + 1) }] : [];
  });
}

export async function removePushTickets(redis: Redis, keys: RedisKeys, tickets: PendingTicket[]): Promise<void> {
  if (tickets.length === 0) return;
  await redis.zrem(setKey(keys), ...tickets.map(member));
}
