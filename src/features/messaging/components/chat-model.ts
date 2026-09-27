/**
 * View models for the conversation list and the chat screen (pure, no React): counterpart
 * lookup, last-message previews, list timestamps and the rows of the inverted chat list
 * (messages, day separators, bubble grouping and delivery state).
 */
import { differenceInCalendarDays, differenceInMinutes, isValid, parseISO, startOfDay } from 'date-fns';

import { getMessagePreview } from '@/features/messaging/message-rules';
import type { Conversation, ConversationParticipant, Message } from '@/types/domain';

// ─────────────────────────────── Conversations ───────────────────────────────

/** The other participant of a two-party conversation (`null` when missing). */
export function getCounterpart(
  conversation: Pick<Conversation, 'participants'>,
  currentUserId: string | null,
): ConversationParticipant | null {
  return conversation.participants.find((participant) => participant.userId !== currentUserId) ?? null;
}

export interface ConversationPreview {
  /** Single-line, truncated message text. */
  text: string;
  /** Sent by the current user (rendered as "You: …"). */
  mine: boolean;
}

/** Preview of the last message, or `null` when the conversation has no messages yet. */
export function getConversationPreview(
  conversation: Pick<Conversation, 'lastMessage'>,
  currentUserId: string | null,
  maxLength = 80,
): ConversationPreview | null {
  const message = conversation.lastMessage;
  if (!message) return null;
  return { text: getMessagePreview(message.text, maxLength), mine: message.senderId === currentUserId };
}

/** Timestamp shown in the conversation list: the time today, "Yesterday", the weekday this week, else a date. */
export type ListTimeKind = 'time' | 'yesterday' | 'weekday' | 'date';

export function getListTimeKind(value: string, now: Date): ListTimeKind {
  const date = parseISO(value);
  if (!isValid(date)) return 'date';
  const days = differenceInCalendarDays(now, date);
  if (days <= 0) return 'time';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'weekday';
  return 'date';
}

/** Last activity used to order conversations (last message, else creation). */
export function getConversationActivityAt(conversation: Pick<Conversation, 'lastMessage' | 'createdAt'>): string {
  return conversation.lastMessage?.createdAt ?? conversation.createdAt;
}

// ─────────────────────────────── Chat rows ───────────────────────────────

/** A message that could not be sent; kept locally so the user can retry it. */
export interface FailedMessage {
  clientMessageId: string;
  text: string;
  /** When the user first tried to send it. */
  createdAt: string;
}

export type MessageDeliveryState = 'sending' | 'failed' | 'sent' | 'read';

export interface ChatMessageRow {
  kind: 'message';
  key: string;
  message: Message;
  mine: boolean;
  /** Delivery state of the current user's messages (`null` for the counterpart's). */
  delivery: MessageDeliveryState | null;
  /** Present for locally failed messages (tap to retry). */
  failed: FailedMessage | null;
  /** The chronologically previous message is from the same sender, close in time → tighter spacing. */
  groupedWithPrevious: boolean;
  /** The chronologically next message continues the group → no bubble tail. */
  groupedWithNext: boolean;
}

export interface ChatDayRow {
  kind: 'day';
  key: string;
  /** Local midnight of the day. */
  day: Date;
  /** Calendar days before `now` (0 = today). */
  daysAgo: number;
}

export type ChatRow = ChatMessageRow | ChatDayRow;

/** Consecutive messages of one sender within this window form a visual group. */
export const MESSAGE_GROUP_WINDOW_MINUTES = 5;

export interface BuildChatRowsInput {
  /** Messages newest first (as returned by `useConversationMessages`). */
  messages: readonly Message[];
  /** Locally failed messages (any order). */
  failed?: readonly FailedMessage[];
  currentUserId: string | null;
  now: Date;
  /** Tells optimistic (still sending) messages apart. */
  isPending: (message: Message) => boolean;
}

function toTime(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function failedToMessage(failed: FailedMessage, senderId: string, conversationId: string): Message {
  return {
    id: `failed:${failed.clientMessageId}`,
    conversationId,
    senderId,
    text: failed.text,
    createdAt: failed.createdAt,
    readAt: null,
    clientMessageId: failed.clientMessageId,
  };
}

function isGrouped(a: Message, b: Message): boolean {
  if (a.senderId !== b.senderId) return false;
  const first = parseISO(a.createdAt);
  const second = parseISO(b.createdAt);
  if (!isValid(first) || !isValid(second)) return false;
  return (
    differenceInCalendarDays(first, second) === 0 && Math.abs(differenceInMinutes(first, second)) < MESSAGE_GROUP_WINDOW_MINUTES
  );
}

/**
 * Rows for an **inverted** chat list (index 0 renders at the bottom): newest first, with a day
 * separator after the oldest message of each day (so it renders above that day's messages).
 *
 * Failed messages are merged in by time unless the server already has them (same
 * `clientMessageId`). The current user's messages count as `read` once `readAt` is set: the server
 * sets it when the counterpart opens the chat or replies, and pushes a `conversation.read` receipt
 * that updates the cached messages live.
 */
export function buildChatRows({ messages, failed = [], currentUserId, now, isPending }: BuildChatRowsInput): ChatRow[] {
  const knownClientIds = new Set(messages.map((message) => message.clientMessageId).filter(Boolean));
  const conversationId = messages[0]?.conversationId ?? '';
  const failedById = new Map<string, FailedMessage>();
  const failedMessages = failed
    .filter((item) => !knownClientIds.has(item.clientMessageId))
    .map((item) => {
      const message = failedToMessage(item, currentUserId ?? '', conversationId);
      failedById.set(message.id, item);
      return message;
    });

  // Newest first; the sort is stable so equal timestamps keep the server order.
  const all = [...messages, ...failedMessages].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));

  const rows: ChatRow[] = [];
  all.forEach((message, index) => {
    const mine = message.senderId === currentUserId;
    const failedItem = failedById.get(message.id) ?? null;
    let delivery: MessageDeliveryState | null = null;
    if (mine) {
      if (failedItem) delivery = 'failed';
      else if (isPending(message)) delivery = 'sending';
      else if (message.readAt !== null) delivery = 'read';
      else delivery = 'sent';
    }
    const newer = all[index - 1];
    const older = all[index + 1];
    rows.push({
      kind: 'message',
      key: message.clientMessageId ? `c:${message.clientMessageId}` : `m:${message.id}`,
      message,
      mine,
      delivery,
      failed: failedItem,
      groupedWithPrevious: older ? isGrouped(older, message) : false,
      groupedWithNext: newer ? isGrouped(message, newer) : false,
    });

    const created = parseISO(message.createdAt);
    const day = startOfDay(isValid(created) ? created : now);
    const olderCreated = older ? parseISO(older.createdAt) : null;
    const olderDay = olderCreated && isValid(olderCreated) ? startOfDay(olderCreated) : null;
    if (!olderDay || olderDay.getTime() !== day.getTime()) {
      rows.push({ kind: 'day', key: `day:${day.getTime()}`, day, daysAgo: differenceInCalendarDays(now, day) });
    }
  });
  return rows;
}

/**
 * Id of the newest counterpart message that is still unread, or `null`. The chat marks the
 * conversation as read whenever this changes (on open and when new messages arrive).
 */
export function getLatestIncomingUnreadId(messages: readonly Message[], currentUserId: string | null): string | null {
  const newestIncoming = messages.find((message) => message.senderId !== currentUserId);
  return newestIncoming && newestIncoming.readAt === null ? newestIncoming.id : null;
}
