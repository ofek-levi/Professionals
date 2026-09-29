/** zod schemas of the inbox routes. */
import { z } from 'zod';

import { paginationQueryShape } from '../../lib/pagination.js';
import { queryBoolean } from '../../lib/query-schemas.js';

export const notificationParams = z.object({ notificationId: z.string() });

/** `?unreadOnly=true&cursor=&limit=` (`NotificationsParams`). */
export const listNotificationsQuery = z.object({
  ...paginationQueryShape,
  unreadOnly: queryBoolean().transform((value) => value ?? false),
});
