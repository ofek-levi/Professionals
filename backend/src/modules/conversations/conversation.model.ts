/**
 * `conversations`: the chat between the two parties of a job. The last message and each
 * participant's unread counter are kept on the document (updated in the same transaction as the
 * message) so the conversation list is one indexed query without per-conversation lookups.
 */
import { Schema, model, type Types } from 'mongoose';

import { modelTimestamps } from '../../infra/model-clock.js';
import { CATEGORY_IDS, type CategoryId } from '../../shared/catalog/index.js';
import { USER_ROLES, type UserRole } from '../../shared/domain.js';

export interface ConversationParticipantDoc {
  user: Types.ObjectId;
  role: UserRole;
  /** Messages from the other participant this user has not read. */
  unreadCount: number;
}

/** Copy of the newest message (`readAt` follows the read receipt). */
export interface LastMessageDoc {
  message: Types.ObjectId;
  sender: Types.ObjectId;
  text: string;
  clientMessageId: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface ConversationDoc {
  _id: Types.ObjectId;
  job: Types.ObjectId;
  request: Types.ObjectId;
  /**
   * The job's category (never changes), copied here because every message notification carries it:
   * sending a message then needs no job lookup (the hottest write path).
   */
  categoryId: CategoryId;
  /** Exactly two: the customer and the professional's user. */
  participants: ConversationParticipantDoc[];
  lastMessage: LastMessageDoc | null;
  /** Sort key of the list: last message time, or creation time before the first message. */
  lastActivityAt: Date;
  /** Closed when the job is cancelled. */
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<ConversationParticipantDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    unreadCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const lastMessageSchema = new Schema<LastMessageDoc>(
  {
    message: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    clientMessageId: { type: String, required: true },
    createdAt: { type: Date, required: true },
    readAt: { type: Date, default: null },
  },
  { _id: false },
);

const conversationSchema = new Schema<ConversationDoc>(
  {
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    request: { type: Schema.Types.ObjectId, ref: 'Request', required: true },
    categoryId: { type: String, enum: CATEGORY_IDS, required: true },
    participants: { type: [participantSchema], required: true },
    lastMessage: { type: lastMessageSchema, default: null },
    lastActivityAt: { type: Date, required: true },
    isOpen: { type: Boolean, default: true },
  },
  { timestamps: modelTimestamps(), versionKey: false },
);

// One conversation per job (`ensureConversationForJob` is idempotent on it).
conversationSchema.index({ job: 1 }, { unique: true });
// GET /conversations: the user's conversations, most recent activity first (keyset + totalCount).
conversationSchema.index({ 'participants.user': 1, lastActivityAt: -1, _id: -1 });
// GET /conversations/unread-count (the inbox badge, refetched on every message): with `$elemMatch`
// on both fields the scan is bounded to the conversations where this user has unread messages.
conversationSchema.index({ 'participants.user': 1, 'participants.unreadCount': 1 }, { name: 'participant_unread' });

export const ConversationModel = model<ConversationDoc>('Conversation', conversationSchema);
