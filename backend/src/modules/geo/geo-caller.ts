/**
 * The `GeocodeCaller` of a `/geo/*` request: signed in (valid bearer token) → budget per user,
 * otherwise per IP and in the anonymous lane of the provider gate (see `CachedGeocoder`).
 */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { withinFixedWindow } from '../../infra/fixed-window.js';
import type { GeocodeCaller } from '../../infra/geo/index.js';
import { KEY_SPACES } from '../../infra/keys.js';
import { ApiError } from '../../lib/errors.js';
import { bearerClaims } from '../../middleware/auth.js';
import { clientIpKey, RATE_LIMITS } from '../../middleware/rate-limit.js';

export function geocodeCaller(deps: Pick<AppDeps, 'env' | 'clock' | 'redis' | 'keys' | 'logger'>, req: Request): GeocodeCaller {
  const claims = bearerClaims(deps, req);
  const rule = claims ? RATE_LIMITS.geoMissesPerUser : RATE_LIMITS.geoMissesPerIp;
  const key = deps.keys.key(KEY_SPACES.rateLimit, 'geo-miss', claims ? `user:${claims.userId}` : clientIpKey(req));
  return {
    anonymous: claims === null,
    async chargeMiss() {
      if (!deps.env.rateLimit.enabled) return;
      let allowed = true;
      try {
        allowed = await withinFixedWindow(deps.redis, key, rule.limit, rule.windowMs);
      } catch (error) {
        deps.logger.warn({ err: error }, 'geocoder miss budget unavailable');
      }
      if (!allowed) throw ApiError.rateLimited('Too many new address searches, please try again in a minute');
    },
  };
}
