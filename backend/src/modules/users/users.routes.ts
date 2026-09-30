/**
 * Account routes: `GET`/`PATCH /me`, `PUT`/`DELETE /me/avatar`, `POST /me/devices`,
 * `DELETE /me/devices/:token`.
 */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { imageMultipart } from '../../middleware/multipart.js';
import { vm } from '../../shared/validation-messages.js';
import { AVATAR_IMAGE } from './avatar.service.js';
import { addDevice, deleteAvatar, deleteDevice, getMe, putAvatar, updateMe } from './users.controller.js';

export function createUsersRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  router.get('/me', auth, asyncHandler(getMe()));
  router.patch('/me', auth, asyncHandler(updateMe()));
  router.put('/me/avatar', auth, imageMultipart(deps, { field: AVATAR_IMAGE.field, maxFiles: 1, tooManyFiles: vm('upload.invalid') }), asyncHandler(putAvatar(deps)));
  router.delete('/me/avatar', auth, asyncHandler(deleteAvatar(deps)));
  router.post('/me/devices', auth, asyncHandler(addDevice(deps)));
  router.delete('/me/devices/:token', auth, asyncHandler(deleteDevice()));
  return router;
}
