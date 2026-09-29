/** Dashboard routes: `GET /customer/dashboard`, `GET /professional/dashboard`. */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { customer, professional } from './dashboard.controller.js';

export function createDashboardRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  router.get('/customer/dashboard', auth, requireRole('customer'), asyncHandler(customer()));
  router.get('/professional/dashboard', auth, requireRole('professional'), asyncHandler(professional(deps)));
  return router;
}
