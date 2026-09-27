import type { PaginationParams } from './common';

/** `GET /notifications` */
export interface NotificationsParams extends PaginationParams {
  unreadOnly?: boolean;
}

export interface UnreadCountResponse {
  count: number;
}
