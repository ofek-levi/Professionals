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
 * Applies a read by `readerId` to `conversation` (loaded in the same transaction). Returns
 * whether any message became read.
 */
export async function applyConversationRead(
  deps: ReadDeps,
  conversation: ConversationDoc,
  readerId: Types.ObjectId,
  tx: Tx,
): Promise<boolean> {
  const readAt = deps.clock.now();
  const counterpart = counterpartOf(conversation, readerId).user;
  const { modifiedCount } = await MessageModel.updateMany(
    { conversation: conversation._id, sender: counterpart, readAt: null },
    { $set: { readAt } },
    { session: tx.session },
  );
  const last = conversation.lastMessage;
  const lastUnread = last !== null && last.readAt === null && last.sender.equals(counterpart);
  if (modifiedCount > 0 || lastUnread || participantOf(conversation, readerId).unreadCount > 0) {
    await ConversationModel.updateOne(
      { _id: conversation._id },
      { $set: { 'participants.$[reader].unreadCount': 0, ...(lastUnread ? { 'lastMessage.readAt': readAt } : {}) } },
      // A read is not a conversation change: `updatedAt` stays the last activity, as in the app.
      { arrayFilters: [{ 'reader.user': readerId }], session: tx.session, timestamps: false },
    );
  }
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
