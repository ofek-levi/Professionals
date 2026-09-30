/**
 * Read receipts (`POST /conversations/:id/read`, and implicitly when replying). Reading marks the
 * counterpart's unread messages read, clears the reader's unread counter and chat notifications
 * and, when a message changed, sends `conversation.read` to both participants after the commit.
 * Runs in a transaction with the message send, so counters and messages never disagree.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { markConversationNotificationsRead } from '../notifications/notifications.service.js';
import { counterpartOf, participantOf, requireParticipantConversation } from './conversation-access.js';
import { ConversationModel, type ConversationDoc } from './conversation.model.js';
import { MessageModel } from './message.model.js';

type ReadDeps = Pick<AppDeps, 'clock' | 'realtime'>;

/**
 * Marks the counterpart's unread messages and the reader's message notifications of the chat read
 * (both index-bounded to what is unread) and announces `conversation.read` when a message changed.
 * The conversation document itself is the caller's to update.
 */
export async function readCounterpartMessages(
  deps: ReadDeps,
  conversation: Pick<ConversationDoc, '_id' | 'participants'>,
  readerId: Types.ObjectId,
  readAt: Date,
  tx: Tx,
): Promise<boolean> {
  const { modifiedCount } = await MessageModel.updateMany(
    { conversation: conversation._id, sender: counterpartOf(conversation, readerId).user, readAt: null },
    { $set: { readAt } },
    { session: tx.session },
  );
  await markConversationNotificationsRead(readerId, conversation._id, readAt, tx.session);
  if (modifiedCount === 0) return false;
  await publishEvent(
    deps.realtime,
    conversation.participants.map((participant) => participant.user),
    {
      type: 'conversation.read',
      conversationId: conversation._id.toHexString(),
      readerId: readerId.toHexString(),
      readAt: readAt.toISOString(),
    },
    tx,
  );
  return true;
}

/**
 * Applies a read by `readerId` to `conversation` (loaded in the same transaction): the messages
 * and notifications, then the reader's counter and the last message's receipt. Returns whether any
 * message became read.
 */
async function applyConversationRead(
  deps: ReadDeps,
  conversation: ConversationDoc,
  readerId: Types.ObjectId,
  tx: Tx,
): Promise<boolean> {
  const readAt = deps.clock.now();
  const changed = await readCounterpartMessages(deps, conversation, readerId, readAt, tx);
  const last = conversation.lastMessage;
  const lastUnread = last !== null && last.readAt === null && last.sender.equals(counterpartOf(conversation, readerId).user);
  if (changed || lastUnread || participantOf(conversation, readerId).unreadCount > 0) {
    await ConversationModel.updateOne(
      { _id: conversation._id },
      { $set: { 'participants.$[reader].unreadCount': 0, ...(lastUnread ? { 'lastMessage.readAt': readAt } : {}) } },
      // A read is not a conversation change: `updatedAt` stays the last activity, as in the app.
      { arrayFilters: [{ 'reader.user': readerId }], session: tx.session, timestamps: false },
    );
  }
  return changed;
}

export async function markConversationRead(
  deps: ReadDeps & Pick<AppDeps, 'logger'>,
  userId: Types.ObjectId,
  conversationId: Types.ObjectId,
): Promise<void> {
  await withTransaction(deps.logger, async (tx) => {
    const conversation = await requireParticipantConversation(conversationId, userId, tx.session);
    await applyConversationRead(deps, conversation, userId, tx);
  });
}
