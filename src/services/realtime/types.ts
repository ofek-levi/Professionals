import type { AppNotification, Message } from '@/types/domain';

/**
 * Server → client push events. Today they are emitted in-process by the mock backend; later the
 * same events can arrive over a WebSocket/SSE connection or a push-notification payload.
 */
export type RealtimeEvent =
  | { type: 'notification.created'; notification: AppNotification }
  | { type: 'message.created'; message: Message }
  /**
   * `readerId` read the conversation at `readAt`: every message the other participant sent up to
   * then is read (read receipts). Sent to both participants.
   */
  | { type: 'conversation.read'; conversationId: string; readerId: string; readAt: string }
  | { type: 'request.updated'; requestId: string }
  | { type: 'offer.updated'; offerId: string; requestId: string }
  | { type: 'job.updated'; jobId: string; requestId: string }
  | { type: 'profile.updated'; professionalId: string };

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeClient {
  /** Opens the connection for the given access token. Safe to call repeatedly. */
  connect(accessToken: string): void;
  disconnect(): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: RealtimeListener): () => void;
}
