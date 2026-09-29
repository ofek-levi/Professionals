/** Loading a conversation for one of its participants (authorization of every messaging route). */
import type { ClientSession, Types } from 'mongoose';

import { ApiError } from '../../lib/errors.js';
import { parseObjectId } from '../../lib/ids.js';
import { ConversationModel, type ConversationDoc, type ConversationParticipantDoc } from './conversation.model.js';
import { CONVERSATION_VIEW_PROJECTION } from './conversations.views.js';

/** Parses a path id (malformed → 404, like a missing conversation). */
export function parseConversationId(value: string): Types.ObjectId {
  return parseObjectId(value, 'Conversation');
}

/** The conversation, or 404 when it does not exist and 403 when `userId` is not a participant. */
export async function requireParticipantConversation(
  conversationId: Types.ObjectId,
  userId: Types.ObjectId,
  session?: ClientSession,
): Promise<ConversationDoc> {
  const conversation = await ConversationModel.findById(conversationId, CONVERSATION_VIEW_PROJECTION)
    .session(session ?? null)
    .lean<ConversationDoc>();
  if (!conversation) throw ApiError.notFound('Conversation');
  if (!conversation.participants.some((participant) => participant.user.equals(userId))) {
    throw ApiError.forbidden('You are not a participant of this conversation');
  }
  return conversation;
}

export function participantOf(conversation: ConversationDoc, userId: Types.ObjectId): ConversationParticipantDoc {
  const participant = conversation.participants.find((p) => p.user.equals(userId));
  if (!participant) throw new Error(`User ${userId.toHexString()} is not in conversation ${conversation._id.toHexString()}`);
  return participant;
}

/** The other participant of the two-party conversation. */
export function counterpartOf(conversation: ConversationDoc, userId: Types.ObjectId): ConversationParticipantDoc {
  const other = conversation.participants.find((p) => !p.user.equals(userId));
  if (!other) throw new Error(`Conversation ${conversation._id.toHexString()} has no counterpart for ${userId.toHexString()}`);
  return other;
}
