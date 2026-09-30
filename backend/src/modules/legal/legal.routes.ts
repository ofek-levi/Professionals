/**
 * Legal documents (Terms of Use, Privacy Policy, account deletion), public: `GET /v1/legal/:document`
 * (JSON for the app, mounted with the other `/v1` routers) and the pages `GET /legal/:document`
 * (mounted at the root by `app.ts`, like `/health`: the URLs given to the app stores and Google).
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { principalKey, RATE_LIMITS, rateLimit } from '../../middleware/rate-limit.js';
import { getLegalDocument, getLegalPage, tooManyRequestsPage } from './legal.controller.js';

export function createLegalRouter(deps: AppDeps): Router {
  const router = Router();
  router.get(
    '/legal/:document',
    rateLimit(deps, 'legal-document', { ...RATE_LIMITS.publicReads, key: principalKey(deps) }),
    asyncHandler(getLegalDocument(deps)),
  );
  return router;
}

export function createLegalPagesRouter(deps: AppDeps): Router {
  const router = Router();
  router.get(
    '/legal/:document',
    rateLimit(deps, 'legal-page-ip', { ...RATE_LIMITS.publicReads, onRefused: tooManyRequestsPage }),
    asyncHandler(getLegalPage(deps)),
  );
  return router;
}
