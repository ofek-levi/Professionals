/** Reading conversations and their messages (participants only). */
import type { Types } from 'mongoose';

import { descendingBy, findPage, NEWEST_FIRST, type PageParams } from '../../lib/pagination.js';
import type { Conversation, Message, Paginated, UnreadCountResponse } from '../../shared/contract/index.js';
import { requireParticipantConversation } from './conversation-access.js';
import { ConversationModel, type ConversationDoc } from './conversation.model.js';
import { CONVERSATION_VIEW_PROJECTION, toConversationDtos, toMessageDto } from './conversations.views.js';
import { MessageModel, type MessageDoc } from './message.model.js';

/** Most recent activity first (the app's list order: last message, else creation). */
const RECENT_ACTIVITY_FIRST = descendingBy('lastActivityAt');

const MESSAGE_PROJECTION = { conversation: 1, sender: 1, text: 1, clientMessageId: 1, readAt: 1, createdAt: 1 } as const;

export async function listConversations(userId: Types.ObjectId, page: PageParams): Promise<Paginated<Conversation>> {
  const result = await findPage<ConversationDoc>(ConversationModel, {
    filter: { 'participants.user': userId },
    sort: RECENT_ACTIVITY_FIRST,
    page,
    projection: CONVERSATION_VIEW_PROJECTION,
  });
  return { ...result, items: await toConversationDtos(result.items, userId) };
}

/**
 * `GET /conversations/unread-count`: unread messages over all the user's conversations (the inbox
 * badge; the conversation list is paginated, so the app cannot sum it). Reads only conversations
 * where the user has unread messages (`participant_unread` index), and only their counter.
 */
export async function countUnreadMessages(userId: Types.ObjectId): Promise<UnreadCountResponse> {
  const unread = await ConversationModel.find(
    { participants: { $elemMatch: { user: userId, unreadCount: { $gt: 0 } } } },
    { 'participants.$': 1 },
  ).lean<Pick<ConversationDoc, 'participants'>[]>();
  return { count: unread.reduce((sum, conversation) => sum + (conversation.participants[0]?.unreadCount ?? 0), 0) };
}

export async function getConversation(userId: Types.ObjectId, conversationId: Types.ObjectId): Promise<Conversation> {
  const conversation = await requireParticipantConversation(conversationId, userId);
  const [dto] = await toConversationDtos([conversation], userId);
  if (!dto) throw new Error(`Conversation ${conversationId.toHexString()} could not be mapped`);
  return dto;
}

export async function listMessages(userId: Types.ObjectId, conversationId: Types.ObjectId, page: PageParams): Promise<Paginated<Message>> {
  await requireParticipantConversation(conversationId, userId);
  // Newest first: the chat renders an inverted list and loads older pages while scrolling up.
  const result = await findPage<MessageDoc>(MessageModel, {
    filter: { conversation: conversationId },
    sort: NEWEST_FIRST,
    page,
    projection: MESSAGE_PROJECTION,
  });
  return { ...result, items: result.items.map(toMessageDto) };
}

/** A message the sender already stored with this `clientMessageId` (idempotent retries). */
export function findSentMessage(conversationId: Types.ObjectId, senderId: Types.ObjectId, clientMessageId: string): Promise<MessageDoc | null> {
  return MessageModel.findOne({ conversation: conversationId, sender: senderId, clientMessageId }, MESSAGE_PROJECTION).lean<MessageDoc>();
}
