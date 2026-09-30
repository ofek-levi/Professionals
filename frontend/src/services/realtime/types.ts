import type { AppNotification, Message } from '@/types/domain';

/**
 * Server → client events, delivered as JSON frames over the realtime WebSocket
 * (`GET /v1/realtime`) after the change that caused them was committed.
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

export const REALTIME_EVENT_TYPES = [
  'notification.created',
  'message.created',
  'conversation.read',
  'request.updated',
  'offer.updated',
  'job.updated',
  'profile.updated',
] as const satisfies readonly RealtimeEvent['type'][];

export interface RealtimeClient {
  /**
   * Keeps a connection open for the signed-in session until `disconnect()`: it reconnects on its
   * own (and refreshes the access token when the server asks for it). Safe to call repeatedly.
   */
  connect(): void;
  disconnect(): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: RealtimeListener): () => void;
  /**
   * The connection came back after a drop: events may have been missed meanwhile, so listeners
   * refetch what they show. Returns an unsubscribe function.
   */
  onReconnect(listener: () => void): () => void;
}
