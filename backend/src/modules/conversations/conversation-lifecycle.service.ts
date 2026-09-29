/**
 * Conversation creation/closing, called by other modules inside their transactions:
 * accepting an offer creates the job's conversation, cancelling the job closes it.
 */
import type { ClientSession, Types } from 'mongoose';

import { ConversationModel } from './conversation.model.js';

export interface JobConversationInput {
  /** Pre-generate the job id (`newObjectId()`) so job and conversation can reference each other. */
  jobId: Types.ObjectId;
  requestId: Types.ObjectId;
  customerUserId: Types.ObjectId;
  professionalUserId: Types.ObjectId;
  now: Date;
}

/**
 * Returns the id of the job's conversation, creating it when missing (idempotent: unique on
 * `job`). Pass the transaction session so it commits or aborts with the job.
 */
export async function ensureConversationForJob(input: JobConversationInput, session?: ClientSession): Promise<Types.ObjectId> {
  const conversation = await ConversationModel.findOneAndUpdate(
    { job: input.jobId },
    {
      $setOnInsert: {
        job: input.jobId,
        request: input.requestId,
        participants: [
          { user: input.customerUserId, role: 'customer', unreadCount: 0 },
          { user: input.professionalUserId, role: 'professional', unreadCount: 0 },
        ],
        lastMessage: null,
        lastActivityAt: input.now,
        isOpen: true,
      },
    },
    { upsert: true, returnDocument: 'after', session, projection: { _id: 1 } },
  ).lean();
  // `upsert` + `new` always yields a document; the guard only satisfies the type.
  if (!conversation) throw new Error(`Conversation for job ${input.jobId.toHexString()} was not created`);
  return conversation._id;
}

/** Messaging closes when the job is cancelled (no-op when already closed). */
export async function closeConversation(conversationId: Types.ObjectId, session?: ClientSession): Promise<void> {
  await ConversationModel.updateOne({ _id: conversationId, isOpen: true }, { $set: { isOpen: false } }, { session });
}
