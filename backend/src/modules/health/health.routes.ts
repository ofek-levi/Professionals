/**
 * `GET /health` and `GET /ready` (mounted at the root, outside `/v1`). Their per-IP limits count in
 * each instance's memory, so a Redis outage never fails a liveness probe.
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { RATE_LIMITS, rateLimit } from '../../middleware/rate-limit.js';
import { getHealth, getReadiness } from './health.controller.js';

export function createHealthRouter(deps: AppDeps): Router {
  const router = Router();
  const perIp = (name: string) => rateLimit(deps, name, { ...RATE_LIMITS.healthPerIp, perInstance: true });
  router.get('/health', perIp('health-ip'), asyncHandler(getHealth));
  router.get('/ready', perIp('ready-ip'), asyncHandler(getReadiness(deps)));
  return router;
}
