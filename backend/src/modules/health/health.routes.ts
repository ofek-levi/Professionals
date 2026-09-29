/** `GET /health` and `GET /ready` (mounted at the root, outside `/v1`, without rate limits). */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { getHealth, getReadiness } from './health.controller.js';

export function createHealthRouter(deps: AppDeps): Router {
  const router = Router();
  router.get('/health', asyncHandler(getHealth));
  router.get('/ready', asyncHandler(getReadiness(deps)));
  return router;
}
