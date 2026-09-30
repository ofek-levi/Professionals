import type { EntityId, ISODateTimeString } from './common';
import type { UserRole } from './user';

export interface Message {
  id: EntityId;
  conversationId: EntityId;
  senderId: EntityId;
  text: string;
  createdAt: ISODateTimeString;
  /** Read status from the recipient's point of view. */
  readAt: ISODateTimeString | null;
  /** Client-generated id used for idempotency and optimistic updates. */
  clientMessageId: string | null;
}

export interface ConversationParticipant {
  userId: EntityId;
  role: UserRole;
  displayName: string;
  avatarUrl: string | null;
  /** The participant deleted their account: show "Deleted user" (the chat is closed). */
  accountDeleted?: boolean;
}

export interface Conversation {
  id: EntityId;
  jobId: EntityId;
  requestId: EntityId;
  participants: ConversationParticipant[];
  lastMessage: Message | null;
  /** Unread messages for the current user. */
  unreadCount: number;
  /** Messaging is closed once a job is cancelled. */
  isOpen: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
