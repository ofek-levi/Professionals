import type { PaginationParams } from './common';

/** `GET /conversations/:id/messages` – newest first. */
export type ConversationMessagesParams = PaginationParams;

/** `POST /conversations/:id/messages` */
export interface SendMessagePayload {
  text: string;
  /** Client generated id, makes retries idempotent. */
  clientMessageId: string;
}
