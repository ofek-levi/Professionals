/** Account routes: `GET`/`PATCH /me`, `POST /me/devices`, `DELETE /me/devices/:token`. */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { addDevice, deleteDevice, getMe, updateMe } from './users.controller.js';

export function createUsersRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  router.get('/me', auth, asyncHandler(getMe()));
  router.patch('/me', auth, asyncHandler(updateMe()));
  router.post('/me/devices', auth, asyncHandler(addDevice(deps)));
  router.delete('/me/devices/:token', auth, asyncHandler(deleteDevice()));
  return router;
}
