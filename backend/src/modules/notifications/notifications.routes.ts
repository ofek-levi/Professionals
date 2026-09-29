/** Inbox routes (any signed-in user, their own notifications only). */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { list, markAllRead, markRead, unreadCount } from './notifications.controller.js';

export function createNotificationsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  router.get('/notifications', auth, asyncHandler(list()));
  router.get('/notifications/unread-count', auth, asyncHandler(unreadCount()));
  router.post('/notifications/read-all', auth, asyncHandler(markAllRead(deps)));
  router.post('/notifications/:notificationId/read', auth, asyncHandler(markRead(deps)));
  return router;
}
