/**
 * Everything the database holds about one account, for an access request (Privacy Protection Law
 * s.13; `src/export-account.ts`, OPERATIONS.md §9): the documents as stored, by user id, from every
 * collection that has them. Left out: what would let someone act as the user (the password hash, the
 * Google account id, the hashes of refresh tokens and email links) and the internal `writeSeq`.
 * Images are links to the image storage (`images` lists them all). Not in the database, so not
 * here: server logs, backups, and the hashed login-throttle keys in Redis (OPERATIONS.md §9).
 */
import type { Types } from 'mongoose';

import { EmailTokenModel, type EmailTokenDoc } from '../auth/email-token.model.js';
import { SessionModel, type SessionDoc } from '../auth/session.model.js';
import { ConversationModel, type ConversationDoc } from '../conversations/conversation.model.js';
import { MessageModel, type MessageDoc } from '../conversations/message.model.js';
import { JobModel, type JobDoc } from '../jobs/job.model.js';
import { NotificationModel, type NotificationDoc } from '../notifications/notification.model.js';
import { OfferModel, type OfferDoc } from '../offers/offer.model.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { ReviewModel, type ReviewDoc } from '../reviews/review.model.js';
import { accountFilter } from './account-lookup.js';
import { NOT_DELETED, UserModel, type UserDoc } from './user.model.js';

type ExportedUser = Omit<UserDoc, 'passwordHash' | 'googleSub' | 'writeSeq'> & { hasPassword: boolean; linkedToGoogle: boolean };

export interface AccountExport {
  exportedAt: string;
  account: ExportedUser;
  /** A professional's business profile (`null` for a customer). */
  professionalProfile: ProfessionalDoc | null;
  /** A customer's requests. */
  requests: RequestDoc[];
  /** A professional's offers, or the offers on a customer's requests. */
  offers: OfferDoc[];
  jobs: JobDoc[];
  /** Reviews the user wrote (customer) or received (professional). */
  reviews: ReviewDoc[];
  conversations: ConversationDoc[];
  /** Every message of those conversations, both participants'. */
  messages: MessageDoc[];
  notifications: NotificationDoc[];
  /** Signed-in app installs: expiry and push token. */
  sessions: Omit<SessionDoc, 'tokenHash' | 'previousTokenHash'>[];
  /** Pending email links (verify address, reset password): purpose and expiry. */
  emailLinks: Omit<EmailTokenDoc, 'tokenHash'>[];
  /** Every image URL above (avatar, request photos). */
  images: string[];
}

const byCreation = { createdAt: 1, _id: 1 } as const;

/** The export of the account (not deleted) with this sign-in email or id; `null` when there is none. */
export async function exportAccount(emailOrId: string, now: Date): Promise<AccountExport | null> {
  const user = await UserModel.findOne({ ...accountFilter(emailOrId), ...NOT_DELETED }).lean<UserDoc>();
  if (!user) return null;
  const { passwordHash, googleSub, writeSeq: _writeSeq, ...account } = user;
  const userId: Types.ObjectId = user._id;
  const professionalProfile = user.role === 'professional' ? await ProfessionalModel.findById(userId).lean<ProfessionalDoc>() : null;
  const requests = await RequestModel.find({ customer: userId }).sort(byCreation).lean<RequestDoc[]>();
  const offerFilter = user.role === 'professional' ? { professional: userId } : { request: { $in: requests.map((request) => request._id) } };
  const conversations = await ConversationModel.find({ 'participants.user': userId }).sort(byCreation).lean<ConversationDoc[]>();
  const [offers, jobs, reviews, messages, notifications, sessions, emailLinks] = await Promise.all([
    OfferModel.find(offerFilter).sort(byCreation).lean<OfferDoc[]>(),
    JobModel.find({ [user.role]: userId }).sort(byCreation).lean<JobDoc[]>(),
    ReviewModel.find({ [user.role]: userId }).sort(byCreation).lean<ReviewDoc[]>(),
    MessageModel.find({ conversation: { $in: conversations.map((conversation) => conversation._id) } })
      .sort(byCreation)
      .lean<MessageDoc[]>(),
    NotificationModel.find({ user: userId }).sort(byCreation).lean<NotificationDoc[]>(),
    SessionModel.find({ user: userId }, { tokenHash: 0, previousTokenHash: 0 }).sort({ _id: 1 }).lean<AccountExport['sessions']>(),
    EmailTokenModel.find({ user: userId }, { tokenHash: 0 }).sort({ _id: 1 }).lean<AccountExport['emailLinks']>(),
  ]);
  const images = [...(user.avatar ? [user.avatar.url] : []), ...requests.flatMap((request) => request.photos.map((photo) => photo.url))];
  return {
    exportedAt: now.toISOString(),
    account: { ...account, hasPassword: passwordHash !== undefined, linkedToGoogle: googleSub !== undefined },
    professionalProfile,
    requests,
    offers,
    jobs,
    reviews,
    conversations,
    messages,
    notifications,
    sessions,
    emailLinks,
    images,
  };
}
