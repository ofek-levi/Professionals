/** Job routes: `GET /jobs?scope=`; `GET /jobs/:jobId`; `POST /jobs/:jobId/confirm|start|complete`. */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { complete, confirm, getDetails, list, start } from './jobs.controller.js';

export function createJobsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const professional = requireRole('professional');
  router.get('/jobs', auth, asyncHandler(list(deps)));
  router.get('/jobs/:jobId', auth, asyncHandler(getDetails()));
  router.post('/jobs/:jobId/confirm', auth, professional, asyncHandler(confirm(deps)));
  router.post('/jobs/:jobId/start', auth, professional, asyncHandler(start(deps)));
  router.post('/jobs/:jobId/complete', auth, asyncHandler(complete(deps)));
  return router;
}
