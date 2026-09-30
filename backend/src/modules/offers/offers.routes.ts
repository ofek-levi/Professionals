/**
 * Offer routes: `GET|POST /requests/:requestId/offers`; `GET|PATCH /offers/:offerId`;
 * `POST /offers/:offerId/withdraw|accept`; `GET /professional/offers`.
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { RATE_LIMITS, rateLimit, userKey, userRouteLimits } from '../../middleware/rate-limit.js';
import { accept, getDetails, listForRequest, listMine, submit, update, withdraw } from './offers.controller.js';

export function createOffersRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const customer = requireRole('customer');
  const professional = requireRole('professional');
  const limit = userRouteLimits(deps);
  router.get('/requests/:requestId/offers', auth, customer, limit.read('offers-list-for-request'), asyncHandler(listForRequest()));
  router.post(
    '/requests/:requestId/offers',
    auth,
    professional,
    rateLimit(deps, 'offers-submit', { ...RATE_LIMITS.offersPerUser, key: userKey }),
    asyncHandler(submit(deps), { status: 201 }),
  );
  router.get('/offers/:offerId', auth, limit.read('offers-get'), asyncHandler(getDetails()));
  router.patch('/offers/:offerId', auth, professional, limit.write('offers-update'), asyncHandler(update(deps)));
  router.post('/offers/:offerId/withdraw', auth, professional, limit.write('offers-withdraw'), asyncHandler(withdraw(deps)));
  router.post('/offers/:offerId/accept', auth, customer, limit.write('offers-accept'), asyncHandler(accept(deps)));
  router.get('/professional/offers', auth, professional, limit.read('offers-list-mine'), asyncHandler(listMine()));
  return router;
}
