/**
 * Service request routes: `POST /requests`; `GET|PATCH|DELETE /requests/:requestId`;
 * `POST /requests/:requestId/publish|cancel`; `GET /customer/requests`;
 * `GET /professional/requests/nearby`.
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { rateLimit, userKey } from '../../middleware/rate-limit.js';
import { cancel, create, deleteDraft, getDetails, listMine, listNearby, publish, updateDraft } from './requests.controller.js';

/** New requests per customer (anti-spam; a real customer posts a few a day). */
const CREATE_REQUESTS_PER_USER = { windowMs: 60 * 60_000, limit: 30, key: userKey };

export function createRequestsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const customer = requireRole('customer');
  router.post('/requests', auth, customer, rateLimit(deps, 'requests-create', CREATE_REQUESTS_PER_USER), asyncHandler(create(deps), { status: 201 }));
  router.get('/requests/:requestId', auth, asyncHandler(getDetails()));
  router.patch('/requests/:requestId', auth, customer, asyncHandler(updateDraft(deps)));
  router.delete('/requests/:requestId', auth, customer, asyncHandler(deleteDraft(deps)));
  router.post('/requests/:requestId/publish', auth, customer, asyncHandler(publish(deps)));
  router.post('/requests/:requestId/cancel', auth, customer, asyncHandler(cancel(deps)));
  router.get('/customer/requests', auth, customer, asyncHandler(listMine()));
  router.get('/professional/requests/nearby', auth, requireRole('professional'), asyncHandler(listNearby()));
  return router;
}
