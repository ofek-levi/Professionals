/** Customer profile routes (the signed-in customer's own profile). */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getProfile, updateProfile } from './customers.controller.js';

export function createCustomersRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  router.get('/customer/profile', auth, requireRole('customer'), asyncHandler(getProfile()));
  router.patch('/customer/profile', auth, requireRole('customer'), asyncHandler(updateProfile()));
  return router;
}
