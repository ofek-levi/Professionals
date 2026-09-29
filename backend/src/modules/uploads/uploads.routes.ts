/**
 * Upload routes. The per-user rate limit runs after `requireAuth` (it is keyed by the caller) and
 * before multer, so rejected callers never stream a file into memory.
 */
import { Router } from 'express';
import multer from 'multer';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { RATE_LIMITS, rateLimit, userKey } from '../../middleware/rate-limit.js';
import { API_LIMITS } from '../../shared/limits.js';
import { requireStorage, uploadImage } from './uploads.controller.js';

/** One file of at most 8 MB, buffered in memory, plus a few small text fields (ignored). */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: API_LIMITS.uploadMaxBytes, files: 1, fields: 10, fieldSize: 1024, parts: 11 },
});

export function createUploadsRouter(deps: AppDeps): Router {
  const router = Router();
  router.post(
    '/uploads/images',
    requireAuth(deps),
    rateLimit(deps, 'uploads-user', { ...RATE_LIMITS.uploadsPerUser, key: userKey }),
    requireStorage(deps),
    imageUpload.single('file'),
    asyncHandler(uploadImage(deps), { status: 201 }),
  );
  return router;
}
