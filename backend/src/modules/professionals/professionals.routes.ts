/**
 * Professional profile routes: the own profile (professionals) and the public profile, reviews
 * and browse (any signed-in user, as in the app's reference backend).
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { userRouteLimits } from '../../middleware/rate-limit.js';
import { getOwnProfile, getPublicProfile, listReviews, search, updateOwnProfile } from './professionals.controller.js';

export function createProfessionalsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const professional = requireRole('professional');
  const limit = userRouteLimits(deps);
  router.get('/professional/profile', auth, professional, limit.read('professional-profile-get'), asyncHandler(getOwnProfile()));
  router.patch('/professional/profile', auth, professional, limit.write('professional-profile-update'), asyncHandler(updateOwnProfile(deps)));
  router.get('/professionals', auth, limit.search('professionals-search'), asyncHandler(search()));
  router.get('/professionals/:professionalId', auth, limit.read('professionals-get'), asyncHandler(getPublicProfile(deps)));
  router.get('/professionals/:professionalId/reviews', auth, limit.read('professionals-reviews'), asyncHandler(listReviews()));
  return router;
}
