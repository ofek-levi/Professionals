/** `messages`: chat messages. `readAt` is when the recipient read it (read receipts). */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';

export interface MessageDoc {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  text: string;
  /** Client-generated id: retries with the same id return the original message. */
  clientMessageId: string;
  readAt: Date | null;
  createdAt: Date;
}

const messageSchema = new Schema<MessageDoc>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    clientMessageId: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: modelTimestamps({ updatedAt: false }), versionKey: false },
);

// GET /conversations/:id/messages: newest first (keyset) and its totalCount.
messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
// Idempotent send: one message per (conversation, sender, clientMessageId), also under retries.
messageSchema.index({ conversation: 1, sender: 1, clientMessageId: 1 }, { unique: true });
// Read receipts: the counterpart's unread messages. Partial, so it only holds unread messages and
// marking a long conversation read never scans its history.
messageSchema.index({ conversation: 1, sender: 1 }, { name: 'unread_by_sender', partialFilterExpression: { readAt: null } });

export const MessageModel = model<MessageDoc>('Message', messageSchema);
