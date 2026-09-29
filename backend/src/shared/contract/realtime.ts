import type { AppNotification } from './notification.js';
import type { Message } from './messaging.js';

/** Server → client WebSocket frames (the app's `frontend/src/services/realtime/types.ts`). */
export type RealtimeEvent =
  | { type: 'notification.created'; notification: AppNotification }
  | { type: 'message.created'; message: Message }
  | { type: 'conversation.read'; conversationId: string; readerId: string; readAt: string }
  | { type: 'request.updated'; requestId: string }
  | { type: 'offer.updated'; offerId: string; requestId: string }
  | { type: 'job.updated'; jobId: string; requestId: string }
  | { type: 'profile.updated'; professionalId: string };
