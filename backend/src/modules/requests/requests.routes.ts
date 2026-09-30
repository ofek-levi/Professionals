/**
 * Service request routes: `POST /requests`; `GET|PATCH|DELETE /requests/:requestId`;
 * `POST /requests/:requestId/publish|cancel`; `GET /customer/requests`;
 * `GET /professional/requests/nearby`. Creating and editing (drafts) are multipart: the JSON
 * payload in `data`, the photos in `photos`.
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { imageMultipart } from '../../middleware/multipart.js';
import { RATE_LIMITS, rateLimit, userKey, userRouteLimits } from '../../middleware/rate-limit.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { MULTIPART_FIELDS } from '../../shared/multipart-fields.js';
import { vm } from '../../shared/validation-messages.js';
import { REQUEST_PHOTOS } from './request-photos.js';
import { cancel, create, deleteDraft, getDetails, listMine, listNearby, publish, updateDraft } from './requests.controller.js';

export function createRequestsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const customer = requireRole('customer');
  const limit = userRouteLimits(deps);
  const withPhotos = () =>
    imageMultipart(deps, {
      field: REQUEST_PHOTOS.field,
      maxFiles: APP_CONFIG.maxRequestPhotos,
      tooManyFiles: vm('request.tooManyPhotos'),
      jsonField: MULTIPART_FIELDS.payload,
    });
  router.post(
    '/requests',
    auth,
    customer,
    rateLimit(deps, 'requests-create', { ...RATE_LIMITS.requestsPerUser, key: userKey }),
    withPhotos(),
    asyncHandler(create(deps), { status: 201 }),
  );
  router.get('/requests/:requestId', auth, limit.read('requests-get'), asyncHandler(getDetails()));
  router.patch('/requests/:requestId', auth, customer, limit.write('requests-update'), withPhotos(), asyncHandler(updateDraft(deps)));
  router.delete('/requests/:requestId', auth, customer, limit.write('requests-delete'), asyncHandler(deleteDraft(deps)));
  router.post('/requests/:requestId/publish', auth, customer, limit.write('requests-publish'), asyncHandler(publish(deps)));
  router.post('/requests/:requestId/cancel', auth, customer, limit.write('requests-cancel'), asyncHandler(cancel(deps)));
  router.get('/customer/requests', auth, customer, limit.read('requests-list-mine'), asyncHandler(listMine()));
  router.get('/professional/requests/nearby', auth, requireRole('professional'), limit.search('requests-nearby'), asyncHandler(listNearby()));
  return router;
}
