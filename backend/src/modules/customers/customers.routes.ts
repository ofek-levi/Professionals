/** Customer profile routes (the signed-in customer's own profile). */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { userRouteLimits } from '../../middleware/rate-limit.js';
import { getProfile, updateProfile } from './customers.controller.js';

export function createCustomersRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const customer = requireRole('customer');
  const limit = userRouteLimits(deps);
  router.get('/customer/profile', auth, customer, limit.read('customer-profile-get'), asyncHandler(getProfile()));
  router.patch('/customer/profile', auth, customer, limit.write('customer-profile-update'), asyncHandler(updateProfile()));
  return router;
}
