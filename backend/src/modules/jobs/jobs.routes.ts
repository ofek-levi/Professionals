/** Job routes: `GET /jobs?scope=`; `GET /jobs/:jobId`; `POST /jobs/:jobId/confirm|start|complete`. */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { userRouteLimits } from '../../middleware/rate-limit.js';
import { complete, confirm, getDetails, list, start } from './jobs.controller.js';

export function createJobsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const professional = requireRole('professional');
  const limit = userRouteLimits(deps);
  router.get('/jobs', auth, limit.read('jobs-list'), asyncHandler(list(deps)));
  router.get('/jobs/:jobId', auth, limit.read('jobs-get'), asyncHandler(getDetails()));
  router.post('/jobs/:jobId/confirm', auth, professional, limit.write('jobs-confirm'), asyncHandler(confirm(deps)));
  router.post('/jobs/:jobId/start', auth, professional, limit.write('jobs-start'), asyncHandler(start(deps)));
  router.post('/jobs/:jobId/complete', auth, limit.write('jobs-complete'), asyncHandler(complete(deps)));
  return router;
}
