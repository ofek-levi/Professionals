/**
 * `POST /conversations/:id/messages`, ported from the app's reference backend:
 * - a retry with the same `clientMessageId` returns the original message (checked first, and again
 *   through the unique index when two retries race), also once the conversation is closed;
 * - a closed conversation (job cancelled) answers 409 `CONFLICT`;
 * - replying reads the counterpart's messages (read receipt), then the message is stored, the
 *   conversation's last message and the recipient's unread counter are updated, the recipient
 *   gets a `new_message` notification and both participants a `message.created` event.
 * Everything is written in one transaction; events and push follow the commit.
 *
 * This is the hottest write path, so it is kept to few sequential round trips: one parallel batch
 * of reads before the transaction, then the insert, ONE conditional conversation update (which
 * also re-checks `isOpen` and returns the previous counters), the read receipt only when the sender
 * had something unread, and the notification (collapse lookup only when the recipient had unread
 * messages).
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { Message } from '../../shared/contract/index.js';
import { createNotification } from '../notifications/create-notification.service.js';
import { loadUserDisplays } from '../users/user-display.views.js';
import { counterpartOf, participantOf, requireParticipantConversation } from './conversation-access.js';
import { readCounterpartMessages } from './conversation-read.service.js';
import { ConversationModel, type ConversationDoc } from './conversation.model.js';
import { findSentMessage } from './conversations.service.js';
import type { SendMessageInput } from './conversations.schemas.js';
import { toMessageDto } from './conversations.views.js';
import { MessageModel, type MessageDoc } from './message.model.js';

type SendDeps = Pick<AppDeps, 'clock' | 'logger' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background'>;

interface NewMessage {
  auth: AuthContext;
  /** Loaded before the transaction; participants, job and category never change. */
  conversation: ConversationDoc;
  input: SendMessageInput;
  senderName: string;
}

const conversationClosed = () => ApiError.conflict('This conversation is closed');

async function storeMessage(deps: SendDeps, { auth, conversation, input, senderName }: NewMessage, tx: Tx): Promise<Message> {
  const [created] = await MessageModel.create(
    [{ conversation: conversation._id, sender: auth.userId, text: input.text, clientMessageId: input.clientMessageId, readAt: null }],
    { session: tx.session },
  );
  if (!created) throw new Error('Message insert returned nothing');
  const message = created.toObject<MessageDoc>();
  const recipient = counterpartOf(conversation, auth.userId).user;

  // Last message, the recipient's +1 and the sender's read (a reply reads the chat) in one write,
  // conditional on the chat still being open (closed meanwhile → 409, the insert rolls back).
  const before = await ConversationModel.findOneAndUpdate(
    { _id: conversation._id, isOpen: true },
    {
      $set: {
        lastMessage: {
          message: message._id,
          sender: message.sender,
          text: message.text,
          clientMessageId: message.clientMessageId,
          createdAt: message.createdAt,
          readAt: null,
        },
        lastActivityAt: message.createdAt,
        'participants.$[sender].unreadCount': 0,
      },
      $inc: { 'participants.$[recipient].unreadCount': 1 },
    },
    {
      arrayFilters: [{ 'sender.user': auth.userId }, { 'recipient.user': recipient }],
      session: tx.session,
      returnDocument: 'before',
      projection: { participants: 1, lastMessage: 1 },
    },
  ).lean<Pick<ConversationDoc, '_id' | 'participants' | 'lastMessage'>>();
  if (!before) throw conversationClosed();

  // Unread messages (and their notifications) exist only while the counter is up: a message and its
  // +1 are written together, and every read clears both. Nothing unread → no read-receipt queries.
  const lastUnread = before.lastMessage !== null && before.lastMessage.readAt === null && before.lastMessage.sender.equals(recipient);
  if (lastUnread || participantOf(before, auth.userId).unreadCount > 0) {
    await readCounterpartMessages(deps, before, auth.userId, deps.clock.now(), tx);
  }

  const dto = toMessageDto(message);
  await createNotification(
    deps,
    recipient,
    {
      type: 'new_message',
      conversationId: conversation._id,
      categoryId: conversation.categoryId,
      senderRole: participantOf(conversation, auth.userId).role,
      senderName,
      messageText: message.text,
      replacesUnread: participantOf(before, recipient).unreadCount > 0,
    },
    tx,
  );
  await publishEvent(deps.realtime, conversation.participants.map((participant) => participant.user), { type: 'message.created', message: dto }, tx);
  return dto;
}

export async function sendMessage(deps: SendDeps, auth: AuthContext, conversationId: Types.ObjectId, input: SendMessageInput): Promise<Message> {
  const [conversation, original, senders] = await Promise.all([
    requireParticipantConversation(conversationId, auth.userId),
    findSentMessage(conversationId, auth.userId, input.clientMessageId),
    loadUserDisplays([auth.userId]),
  ]);
  if (original) return toMessageDto(original);
  if (!conversation.isOpen) throw conversationClosed();
  const message: NewMessage = { auth, conversation, input, senderName: senders.get(auth.userId.toHexString())?.displayName ?? '' };
  try {
    return await withTransaction(deps.logger, (tx) => storeMessage(deps, message, tx));
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // A concurrent retry with the same clientMessageId committed first: answer with its message.
    const winner = await findSentMessage(conversationId, auth.userId, input.clientMessageId);
    if (!winner) throw error;
    return toMessageDto(winner);
  }
}
