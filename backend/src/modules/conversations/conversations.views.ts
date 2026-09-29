/** `Conversation` / `Message` DTO mappers (participant names and avatars batch-loaded). */
import type { Types } from 'mongoose';

import { required } from '../../lib/batch.js';
import type { Conversation, Message } from '../../shared/contract/index.js';
import { loadUserDisplays } from '../users/user-display.views.js';
import type { ConversationDoc, LastMessageDoc } from './conversation.model.js';
import type { MessageDoc } from './message.model.js';

export type MessageForView = Pick<MessageDoc, '_id' | 'conversation' | 'sender' | 'text' | 'clientMessageId' | 'readAt' | 'createdAt'>;

/** Every field `toConversationDtos` and the list cursor (`lastActivityAt`) read. */
export const CONVERSATION_VIEW_PROJECTION = {
  job: 1,
  request: 1,
  participants: 1,
  lastMessage: 1,
  lastActivityAt: 1,
  isOpen: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

export function toMessageDto(message: MessageForView): Message {
  return {
    id: message._id.toHexString(),
    conversationId: message.conversation.toHexString(),
    senderId: message.sender.toHexString(),
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt ? message.readAt.toISOString() : null,
    clientMessageId: message.clientMessageId,
  };
}

function lastMessageDto(conversationId: Types.ObjectId, last: LastMessageDoc): Message {
  return toMessageDto({ ...last, _id: last.message, conversation: conversationId });
}

/** `unreadCount` is the viewer's own counter. */
export async function toConversationDtos(conversations: ConversationDoc[], viewerId: Types.ObjectId): Promise<Conversation[]> {
  const displays = await loadUserDisplays(conversations.flatMap((conversation) => conversation.participants.map((p) => p.user)));
  return conversations.map((conversation) => ({
    id: conversation._id.toHexString(),
    jobId: conversation.job.toHexString(),
    requestId: conversation.request.toHexString(),
    participants: conversation.participants.map((participant) => {
      const display = required(displays, participant.user, 'User');
      return {
        userId: participant.user.toHexString(),
        role: participant.role,
        displayName: display.displayName,
        avatarUrl: display.avatarUrl,
      };
    }),
    lastMessage: conversation.lastMessage ? lastMessageDto(conversation._id, conversation.lastMessage) : null,
    unreadCount: conversation.participants.find((participant) => participant.user.equals(viewerId))?.unreadCount ?? 0,
    isOpen: conversation.isOpen,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  }));
}
