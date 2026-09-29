/** Catalog routes (public: the sign-up flow needs the categories before an account exists). */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCategories } from './catalog.controller.js';

export function createCatalogRouter(_deps: AppDeps): Router {
  const router = Router();
  router.get('/catalog/categories', asyncHandler(getCategories));
  return router;
}
