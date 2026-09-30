/** Catalog routes (public: the sign-up flow needs the categories before an account exists). */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { principalKey, RATE_LIMITS, rateLimit } from '../../middleware/rate-limit.js';
import { getCategories } from './catalog.controller.js';

export function createCatalogRouter(deps: AppDeps): Router {
  const router = Router();
  router.get(
    '/catalog/categories',
    rateLimit(deps, 'catalog-categories', { ...RATE_LIMITS.publicReads, key: principalKey(deps) }),
    asyncHandler(getCategories),
  );
  return router;
}
