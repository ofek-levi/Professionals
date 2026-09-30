/** zod schemas of the inbox routes. */
import { z } from 'zod';

import { paginationQueryShape } from '../../lib/pagination.js';
import { queryBoolean, queryEnumList } from '../../lib/query-schemas.js';
import { NOTIFICATION_TYPES } from '../../shared/notification-types.js';

export const notificationParams = z.object({ notificationId: z.string() });

/** `?excludeTypes=new_message,…`: leave these types out (the app's Updates list and badge skip chat messages). */
const excludeTypes = queryEnumList(NOTIFICATION_TYPES).transform((value) => value ?? []);

/** `?unreadOnly=true&excludeTypes=&cursor=&limit=` (`NotificationsParams`). */
export const listNotificationsQuery = z.object({
  ...paginationQueryShape,
  unreadOnly: queryBoolean().transform((value) => value ?? false),
  excludeTypes,
});

/** `?excludeTypes=` (`UnreadNotificationsCountParams`). */
export const unreadCountQuery = z.object({ excludeTypes });
