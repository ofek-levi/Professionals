/**
 * Geocoding routes. Public: professionals choose their base address while signing up. One per-IP
 * limiter covers both routes; cache misses (provider calls, ≤ 1/s for everyone) have a much
 * smaller budget per IP or per signed-in user (`geo-caller.ts`).
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { RATE_LIMITS, rateLimit } from '../../middleware/rate-limit.js';
import { reverse, search } from './geo.controller.js';

export function createGeoRouter(deps: AppDeps): Router {
  const router = Router();
  const perIp = rateLimit(deps, 'geo-ip', RATE_LIMITS.geoPerIp);
  router.get('/geo/search', perIp, asyncHandler(search(deps)));
  router.get('/geo/reverse', perIp, asyncHandler(reverse(deps)));
  return router;
}
