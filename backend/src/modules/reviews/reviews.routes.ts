/** Review routes: `POST /jobs/:jobId/review`. (`GET /professionals/:id/reviews` is the professionals module's.) */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { create } from './reviews.controller.js';

export function createReviewsRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/jobs/:jobId/review', requireAuth(deps), requireRole('customer'), asyncHandler(create(deps), { status: 201 }));
  return router;
}
