/**
 * Daily image bytes per user: accounts are free, but every stored image costs storage, upload
 * bandwidth and a resize at the provider. `storeImages` charges a post's files before uploading
 * them (in a 24 h fixed window on Redis) and a post over `API_LIMITS.imageBytesPerUserPerDay`
 * answers 429 with `Retry-After` and is not charged. Posts that were stored are not refunded when
 * their owner is not saved or the images are deleted later. A Redis failure lets posts through.
 */
import type { AppDeps } from '../../deps.js';
import { API_LIMITS } from '../../shared/limits.js';
import { hitFixedWindow } from '../fixed-window.js';
import { KEY_SPACES } from '../keys.js';
import { imageErrors } from './image-errors.js';

const DAY_MS = 24 * 60 * 60_000;

type QuotaDeps = Pick<AppDeps, 'redis' | 'keys' | 'logger'>;

export function imageBytesKey(deps: Pick<AppDeps, 'keys'>, ownerId: string): string {
  return deps.keys.key(KEY_SPACES.rateLimit, 'image-bytes', ownerId);
}

/** Charges `bytes` to `ownerId`'s day; 429 (field `field`) when that would pass the daily limit. */
export async function chargeImageBytes(deps: QuotaDeps, ownerId: string, field: string, bytes: number): Promise<void> {
  if (bytes <= 0) return;
  const key = imageBytesKey(deps, ownerId);
  let total: number;
  try {
    total = await hitFixedWindow(deps.redis, key, DAY_MS, bytes);
  } catch (error) {
    deps.logger.warn({ err: error }, 'image byte quota unavailable');
    return;
  }
  if (total <= API_LIMITS.imageBytesPerUserPerDay) return;
  // Refused: nothing is stored, so nothing is charged (a smaller post may still fit).
  const retryAfterMs = await Promise.all([deps.redis.pttl(key), hitFixedWindow(deps.redis, key, DAY_MS, -bytes)])
    .then(([ttl]) => (ttl > 0 ? ttl : DAY_MS))
    .catch(() => DAY_MS);
  throw imageErrors.rateLimited(field, 'Daily photo upload limit reached, please try again later', Math.ceil(retryAfterMs / 1000));
}
