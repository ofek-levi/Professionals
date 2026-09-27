/** Job conversations: creation on offer acceptance, listing, sending (idempotent) and read receipts. */
import { canSendMessage } from '@/features/messaging/message-rules';
import { DomainError } from '@/features/shared/domain-error';
import { sendMessageSchema } from '@/lib/validation/message';
import type { Paginated, PaginationParams } from '@/types/api';
import type { Conversation, Message } from '@/types/domain';

import type { Actor } from '../auth';
import type { ServerContext } from '../context';
import type { StoredConversation } from '../db';
import { paginate } from '../pagination';
import { messagesForConversation, requireConversation, requireStoredUser } from '../queries';
import { parseBody } from '../validate';
import { toConversation } from '../views';
import { markConversationNotificationsRead, notify } from './notification-service';

export function createConversationForJob(
  ctx: ServerContext,
  input: { jobId: string; requestId: string; customerId: string; professionalUserId: string; id?: string },
): StoredConversation {
  const now = ctx.nowIso();
  return ctx.db.conversations.insert({
    id: input.id ?? ctx.newId('cnv'),
    jobId: input.jobId,
    requestId: input.requestId,
    participants: [
      { userId: input.customerId, role: 'customer' },
      { userId: input.professionalUserId, role: 'professional' },
    ],
    isOpen: true,
    createdAt: now,
    updatedAt: now,
  });
}

export function isParticipant(conversation: StoredConversation, userId: string): boolean {
  return conversation.participants.some((participant) => participant.userId === userId);
}

/** Conversation the user takes part in, or 404/403. */
export function requireParticipantConversation(ctx: ServerContext, userId: string, conversationId: string): StoredConversation {
  const conversation = requireConversation(ctx.db, conversationId);
  if (!isParticipant(conversation, userId)) throw DomainError.forbidden('You are not a participant of this conversation');
  return conversation;
}

/** Other participant of a two-party conversation. */
export function counterpartOf(conversation: StoredConversation, userId: string): StoredConversation['participants'][number] {
  const other = conversation.participants.find((participant) => participant.userId !== userId);
  if (!other) throw new Error(`Conversation ${conversation.id} has no counterpart for ${userId}`);
  return other;
}

const lastActivity = (conversation: Conversation) => Date.parse(conversation.lastMessage?.createdAt ?? conversation.createdAt);

export function listConversations(ctx: ServerContext, userId: string): Conversation[] {
  return ctx.db.conversations
    .filter((conversation) => isParticipant(conversation, userId))
    .map((conversation) => toConversation(ctx, conversation, userId))
    .sort((a, b) => lastActivity(b) - lastActivity(a) || b.id.localeCompare(a.id));
}

export function getConversation(ctx: ServerContext, userId: string, conversationId: string): Conversation {
  return toConversation(ctx, requireParticipantConversation(ctx, userId, conversationId), userId);
}

/** Messages newest first (the chat renders an inverted list). */
export function listMessages(
  ctx: ServerContext,
  userId: string,
  conversationId: string,
  params: PaginationParams,
): Paginated<Message> {
  requireParticipantConversation(ctx, userId, conversationId);
  return paginate(messagesForConversation(ctx.db, conversationId).reverse(), params);
}

/** Marks the counterpart's messages (and related notifications) as read. Returns how many changed. */
export function markConversationRead(ctx: ServerContext, userId: string, conversationId: string): number {
  requireParticipantConversation(ctx, userId, conversationId);
  const readAt = ctx.nowIso();
  const unread = ctx.db.messages.filter(
    (message) => message.conversationId === conversationId && message.senderId !== userId && message.readAt === null,
  );
  unread.forEach((message) => ctx.db.messages.update(message.id, { readAt }));
  markConversationNotificationsRead(ctx, userId, conversationId);
  return unread.length;
}

/**
 * `POST /conversations/:id/messages`. Retries with the same `clientMessageId` return the original
 * message instead of creating a duplicate.
 */
export function sendMessage(ctx: ServerContext, actor: Actor, conversationId: string, body: unknown): Message {
  const conversation = requireParticipantConversation(ctx, actor.userId, conversationId);
  const payload = parseBody(sendMessageSchema, body);
  const duplicate = ctx.db.messages.find(
    (message) =>
      message.conversationId === conversationId &&
      message.senderId === actor.userId &&
      message.clientMessageId === payload.clientMessageId,
  );
  if (duplicate) return duplicate;
  if (!canSendMessage(conversation)) throw DomainError.conflict('This conversation is closed');

  const now = ctx.nowIso();
  // Replying implies the sender has read everything the counterpart wrote.
  markConversationRead(ctx, actor.userId, conversationId);
  const message = ctx.db.messages.insert({
    id: ctx.newId('msg'),
    conversationId,
    senderId: actor.userId,
    text: payload.text,
    createdAt: now,
    readAt: null,
    clientMessageId: payload.clientMessageId,
  });
  ctx.db.conversations.update(conversationId, { updatedAt: now });

  const recipient = counterpartOf(conversation, actor.userId);
  const sender = requireStoredUser(ctx.db, actor.userId);
  const job = ctx.db.jobs.get(conversation.jobId);
  notify(ctx, recipient.userId, {
    type: 'new_message',
    conversationId,
    categoryId: job?.categoryId,
    senderRole: actor.role,
    senderName: sender.displayName,
    messageText: message.text,
  });
  conversation.participants.forEach(({ userId }) => ctx.emit(userId, { type: 'message.created', message }));
  ctx.hooks.onMessageSent(ctx, message);
  return message;
}

/** Messaging closes when the job is cancelled. */
export function closeConversation(ctx: ServerContext, conversationId: string): void {
  const conversation = ctx.db.conversations.get(conversationId);
  if (conversation?.isOpen) ctx.db.conversations.update(conversationId, { isOpen: false, updatedAt: ctx.nowIso() });
}
