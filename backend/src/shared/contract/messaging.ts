import type { UserRole } from '../domain.js';
import type { EntityId, ISODateTimeString } from './common.js';

export interface Message {
  id: EntityId;
  conversationId: EntityId;
  senderId: EntityId;
  text: string;
  createdAt: ISODateTimeString;
  /** When the recipient read it. */
  readAt: ISODateTimeString | null;
  clientMessageId: string | null;
}

export interface ConversationParticipant {
  userId: EntityId;
  role: UserRole;
  displayName: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: EntityId;
  jobId: EntityId;
  requestId: EntityId;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  unreadCount: number;
  isOpen: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
