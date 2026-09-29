/** Inbox endpoints (thin: validate → service). Every signed-in user has an inbox. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { parseObjectId } from '../../lib/ids.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import type { SuccessResponse, UnreadCountResponse } from '../../shared/contract/index.js';
import { listNotificationsQuery, notificationParams } from './notifications.schemas.js';
import { countUnreadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.service.js';

const SUCCESS: SuccessResponse = { success: true };

export const list = () => async (req: Request) => {
  const { query } = validateRequest(req, { query: listNotificationsQuery });
  return listNotifications(authOf(req).userId, { cursor: query.cursor, limit: query.limit, unreadOnly: query.unreadOnly });
};

export const unreadCount = () => async (req: Request): Promise<UnreadCountResponse> => ({
  count: await countUnreadNotifications(authOf(req).userId),
});

export const markRead = (deps: AppDeps) => async (req: Request) => {
  const { params } = validateRequest(req, { params: notificationParams });
  return markNotificationRead(deps, authOf(req).userId, parseObjectId(params.notificationId, 'Notification'));
};

export const markAllRead = (deps: AppDeps) => async (req: Request) => {
  await markAllNotificationsRead(deps, authOf(req).userId);
  return SUCCESS;
};
