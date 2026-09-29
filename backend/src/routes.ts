/**
 * The `/v1` API: one router per module, each declaring full paths (`/customer/requests`, …) with
 * per-route middleware only, so routers can be mounted side by side. Module agents fill their
 * own `<module>.routes.ts`; this file does not change when routes are added.
 */
import { Router } from 'express';

import type { AppDeps } from './deps.js';
import { RATE_LIMITS, rateLimit } from './middleware/rate-limit.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import { createConversationsRouter } from './modules/conversations/conversations.routes.js';
import { createCustomersRouter } from './modules/customers/customers.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createGeoRouter } from './modules/geo/geo.routes.js';
import { createJobsRouter } from './modules/jobs/jobs.routes.js';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.js';
import { createOffersRouter } from './modules/offers/offers.routes.js';
import { createProfessionalsRouter } from './modules/professionals/professionals.routes.js';
import { createRequestsRouter } from './modules/requests/requests.routes.js';
import { createReviewsRouter } from './modules/reviews/reviews.routes.js';
import { createUploadsRouter } from './modules/uploads/uploads.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';

export function createV1Router(deps: AppDeps): Router {
  const v1 = Router();
  v1.use(rateLimit(deps, 'global', RATE_LIMITS.global));
  for (const create of [
    createAuthRouter,
    createUsersRouter,
    createCatalogRouter,
    createGeoRouter,
    createUploadsRouter,
    createCustomersRouter,
    createProfessionalsRouter,
    createRequestsRouter,
    createOffersRouter,
    createJobsRouter,
    createReviewsRouter,
    createConversationsRouter,
    createNotificationsRouter,
    createDashboardRouter,
  ]) {
    v1.use(create(deps));
  }
  return v1;
}
