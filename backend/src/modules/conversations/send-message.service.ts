/**
 * `POST /conversations/:id/messages`, ported from the app's reference backend:
 * - a retry with the same `clientMessageId` returns the original message (checked first, and again
 *   through the unique index when two retries race), also once the conversation is closed;
 * - a closed conversation (job cancelled) answers 409 `CONFLICT`;
 * - replying reads the counterpart's messages (read receipt), then the message is stored, the
 *   conversation's last message and the recipient's unread counter are updated, the recipient
 *   gets a `new_message` notification and both participants a `message.created` event.
 * Everything is written in one transaction; events and push follow the commit.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { ApiError, isDuplicateKeyError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CategoryId } from '../../shared/catalog/index.js';
import type { Message } from '../../shared/contract/index.js';
import { JobModel } from '../jobs/job.model.js';
import { createNotification } from '../notifications/create-notification.service.js';
import { loadUserDisplays } from '../users/user-display.views.js';
import { counterpartOf, participantOf, requireParticipantConversation } from './conversation-access.js';
import { applyConversationRead } from './conversation-read.service.js';
import { ConversationModel } from './conversation.model.js';
import { findSentMessage } from './conversations.service.js';
import type { SendMessageInput } from './conversations.schemas.js';
import { toMessageDto } from './conversations.views.js';
import { MessageModel, type MessageDoc } from './message.model.js';

type SendDeps = Pick<AppDeps, 'clock' | 'logger' | 'realtime' | 'push' | 'redis' | 'keys' | 'background'>;

interface NewMessage {
  auth: AuthContext;
  conversationId: Types.ObjectId;
  input: SendMessageInput;
  senderName: string;
  categoryId: CategoryId | undefined;
}

const conversationClosed = () => ApiError.conflict('This conversation is closed');


async function storeMessage(deps: SendDeps, { auth, conversationId, input, senderName, categoryId }: NewMessage, tx: Tx): Promise<Message> {
  // Re-read inside the transaction: counters and `isOpen` must be the committed state.
  const conversation = await requireParticipantConversation(conversationId, auth.userId, tx.session);
  if (!conversation.isOpen) throw conversationClosed();
  await applyConversationRead(deps, conversation, auth.userId, tx);

  const [created] = await MessageModel.create(
    [{ conversation: conversationId, sender: auth.userId, text: input.text, clientMessageId: input.clientMessageId, readAt: null }],
    { session: tx.session },
  );
  if (!created) throw new Error('Message insert returned nothing');
  const message = created.toObject<MessageDoc>();
  const recipient = counterpartOf(conversation, auth.userId).user;
  await ConversationModel.updateOne(
    { _id: conversationId },
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
      },
      $inc: { 'participants.$[recipient].unreadCount': 1 },
    },
    { arrayFilters: [{ 'recipient.user': recipient }], session: tx.session },
  );

  const dto = toMessageDto(message);
  await createNotification(
    deps,
    recipient,
    {
      type: 'new_message',
      conversationId,
      categoryId,
      senderRole: participantOf(conversation, auth.userId).role,
      senderName,
      messageText: message.text,
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
  const job = await JobModel.findById(conversation.job, { categoryId: 1 }).lean();
  const message: NewMessage = {
    auth,
    conversationId,
    input,
    senderName: senders.get(auth.userId.toHexString())?.displayName ?? '',
    categoryId: job?.categoryId,
  };
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
