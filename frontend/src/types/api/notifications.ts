import type { NotificationType } from '@/constants/notification-types';

import type { PaginationParams } from './common';

/** `GET /notifications` */
export interface NotificationsParams extends PaginationParams {
  unreadOnly?: boolean;
  /** Types left out by the server (the Updates list leaves out `new_message`). */
  excludeTypes?: readonly NotificationType[];
}

/** `GET /notifications/unread-count` */
export interface UnreadNotificationsCountParams {
  excludeTypes?: readonly NotificationType[];
}

export interface UnreadCountResponse {
  count: number;
}
