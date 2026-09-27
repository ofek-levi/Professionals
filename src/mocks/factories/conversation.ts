import type { Message } from '@/types/domain';

import type { StoredConversation } from '../server/db';

export type ConversationInput = Pick<StoredConversation, 'id' | 'jobId' | 'requestId' | 'createdAt'> & {
  customerId: string;
  professionalUserId: string;
} & Partial<StoredConversation>;

export function createConversation({ customerId, professionalUserId, ...input }: ConversationInput): StoredConversation {
  return {
    participants: [
      { userId: customerId, role: 'customer' },
      { userId: professionalUserId, role: 'professional' },
    ],
    isOpen: true,
    updatedAt: input.createdAt,
    ...input,
  };
}

export type MessageInput = Pick<Message, 'id' | 'conversationId' | 'senderId' | 'text' | 'createdAt'> & Partial<Message>;

export function createMessage(input: MessageInput): Message {
  return { readAt: null, clientMessageId: null, ...input };
}
