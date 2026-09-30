/** Dashboard routes: `GET /customer/dashboard`, `GET /professional/dashboard`. */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { userRouteLimits } from '../../middleware/rate-limit.js';
import { customer, professional } from './dashboard.controller.js';

export function createDashboardRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const limit = userRouteLimits(deps);
  router.get('/customer/dashboard', auth, requireRole('customer'), limit.read('customer-dashboard'), asyncHandler(customer()));
  router.get('/professional/dashboard', auth, requireRole('professional'), limit.read('professional-dashboard'), asyncHandler(professional(deps)));
  return router;
}
