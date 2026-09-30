/** Inbox routes (any signed-in user, their own notifications only). */
import { Router } from 'express';

import type { AppDeps } from '../../deps.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { userRouteLimits } from '../../middleware/rate-limit.js';
import { list, markAllRead, markRead, unreadCount } from './notifications.controller.js';

export function createNotificationsRouter(deps: AppDeps): Router {
  const router = Router();
  const auth = requireAuth(deps);
  const limit = userRouteLimits(deps);
  router.get('/notifications', auth, limit.read('notifications-list'), asyncHandler(list()));
  router.get('/notifications/unread-count', auth, limit.read('notifications-unread-count'), asyncHandler(unreadCount()));
  router.post('/notifications/read-all', auth, limit.write('notifications-read-all'), asyncHandler(markAllRead(deps)));
  router.post('/notifications/:notificationId/read', auth, limit.readMarker('notifications-read'), asyncHandler(markRead(deps)));
  return router;
}
