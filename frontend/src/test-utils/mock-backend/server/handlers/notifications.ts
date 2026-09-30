/** `/notifications/*` routes. */
import { NOTIFICATION_TYPES } from '@/constants/notification-types';
import type { UnreadCountResponse } from '@/types/api';

import { route } from '../router';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from '../services/notification-service';
import { paginationFrom, SUCCESS } from './shared';

export const notificationRoutes = [
  route({
    method: 'GET',
    path: '/notifications',
    auth: 'user',
    handler: ({ ctx, actor, query }) =>
      listNotifications(ctx, actor.userId, {
        ...paginationFrom(query),
        unreadOnly: query.boolean('unreadOnly'),
        excludeTypes: query.enumList('excludeTypes', NOTIFICATION_TYPES),
      }),
  }),
  route({
    method: 'GET',
    path: '/notifications/unread-count',
    auth: 'user',
    handler: ({ ctx, actor, query }): UnreadCountResponse => ({
      count: unreadNotificationCount(ctx, actor.userId, query.enumList('excludeTypes', NOTIFICATION_TYPES)),
    }),
  }),
  route({
    method: 'POST',
    path: '/notifications/read-all',
    auth: 'user',
    handler: ({ ctx, actor }) => {
      markAllNotificationsRead(ctx, actor.userId);
      return SUCCESS;
    },
  }),
  route({
    method: 'POST',
    path: '/notifications/:notificationId/read',
    auth: 'user',
    handler: ({ ctx, actor, params }) => markNotificationRead(ctx, actor.userId, params.notificationId),
  }),
];
