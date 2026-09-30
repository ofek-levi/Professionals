/** Inbox endpoints (thin: validate → service). Every signed-in user has an inbox. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { parseObjectId } from '../../lib/ids.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import type { SuccessResponse, UnreadCountResponse } from '../../shared/contract/index.js';
import { listNotificationsQuery, notificationParams, unreadCountQuery } from './notifications.schemas.js';
import { countUnreadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.service.js';

const SUCCESS: SuccessResponse = { success: true };

export const list = () => async (req: Request) => {
  const { query } = validateRequest(req, { query: listNotificationsQuery });
  return listNotifications(authOf(req).userId, {
    cursor: query.cursor,
    limit: query.limit,
    unreadOnly: query.unreadOnly,
    excludeTypes: query.excludeTypes,
  });
};

export const unreadCount = () => async (req: Request): Promise<UnreadCountResponse> => {
  const { query } = validateRequest(req, { query: unreadCountQuery });
  return { count: await countUnreadNotifications(authOf(req).userId, query.excludeTypes) };
};

export const markRead = (deps: AppDeps) => async (req: Request) => {
  const { params } = validateRequest(req, { params: notificationParams });
  return markNotificationRead(deps, authOf(req).userId, parseObjectId(params.notificationId, 'Notification'));
};

export const markAllRead = (deps: AppDeps) => async (req: Request) => {
  await markAllNotificationsRead(deps, authOf(req).userId);
  return SUCCESS;
};
