/**
 * Offer routes: `GET|POST /requests/:requestId/offers`; `GET|PATCH /offers/:offerId`;
 * `POST /offers/:offerId/withdraw|accept`; `GET /professional/offers`.
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { rateLimit, userKey } from '../../middleware/rate-limit.js';
import { accept, getDetails, listForRequest, listMine, submit, update, withdraw } from './offers.controller.js';

/** New offers per professional (anti-spam; far above what one person sends). */
const SUBMIT_OFFERS_PER_USER = { windowMs: 10 * 60_000, limit: 60, key: userKey };

export function createOffersRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const customer = requireRole('customer');
  const professional = requireRole('professional');
  router.get('/requests/:requestId/offers', auth, customer, asyncHandler(listForRequest()));
  router.post(
    '/requests/:requestId/offers',
    auth,
    professional,
    rateLimit(deps, 'offers-submit', SUBMIT_OFFERS_PER_USER),
    asyncHandler(submit(deps), { status: 201 }),
  );
  router.get('/offers/:offerId', auth, asyncHandler(getDetails()));
  router.patch('/offers/:offerId', auth, professional, asyncHandler(update(deps)));
  router.post('/offers/:offerId/withdraw', auth, professional, asyncHandler(withdraw(deps)));
  router.post('/offers/:offerId/accept', auth, customer, asyncHandler(accept(deps)));
  router.get('/professional/offers', auth, professional, asyncHandler(listMine()));
  return router;
}
