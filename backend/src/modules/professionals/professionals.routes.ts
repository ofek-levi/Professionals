/**
 * Professional profile routes: the own profile (professionals) and the public profile, reviews
 * and browse (any signed-in user, as in the app's reference backend).
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getOwnProfile, getPublicProfile, listReviews, search, updateOwnProfile } from './professionals.controller.js';

export function createProfessionalsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  router.get('/professional/profile', auth, requireRole('professional'), asyncHandler(getOwnProfile()));
  router.patch('/professional/profile', auth, requireRole('professional'), asyncHandler(updateOwnProfile(deps)));
  router.get('/professionals', auth, asyncHandler(search()));
  router.get('/professionals/:professionalId', auth, asyncHandler(getPublicProfile(deps)));
  router.get('/professionals/:professionalId/reviews', auth, asyncHandler(listReviews()));
  return router;
}
