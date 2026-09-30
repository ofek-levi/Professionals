/**
 * What deleting an account erases and what it keeps, inside the deletion's transaction (the
 * Privacy Policy and the account-deletion page say exactly this: change them together). Images
 * are deleted from storage after the commit.
 *
 * Kept, without the person: the `users`/`professionals` documents as tombstones (id, role,
 * language, dates, a professional's stats) so the other parties' offers, jobs, chats and reviews
 * still resolve, shown as "Deleted user"; a customer's requests with their description, category,
 * dates, status, city/neighbourhood and approximate pin (the exact point, street address, access
 * details, notes, cancellation comment, photos and idempotency key go; drafts go entirely); the
 * ratings a customer gave (their comments go); a professional's offers with price and dates (their
 * messages go); every chat message, in chats that are all closed now.
 */
import { randomBytes } from 'node:crypto';

import type { PipelineStage, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { discardImages } from '../../infra/storage/store-images.js';
import { DELETED_USER_NAME } from '../../lib/text.js';
import type { NotificationPreferences } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { EmailTokenModel } from '../auth/email-token.model.js';
import { revokeAllSessions } from '../auth/session.service.js';
import { ConversationModel } from '../conversations/conversation.model.js';
import { NotificationModel } from '../notifications/notification.model.js';
import { OfferModel } from '../offers/offer.model.js';
import { invalidatePublicProfessionalProfile } from '../professionals/professional-cache.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { discardAfterCommit, publicIdsOf } from '../requests/request-photos.js';
import { RequestModel, type RequestDoc } from '../requests/request.model.js';
import { ReviewModel } from '../reviews/review.model.js';
import { UserModel, type UserDoc } from './user.model.js';

type ErasureDeps = Pick<AppDeps, 'storage' | 'logger' | 'background' | 'redis' | 'keys' | 'cache'>;

/** Where the confirmation email goes: the account's details before they were erased. */
export interface ErasedAccount {
  email: string;
  firstName: string;
  language: AppLanguage;
}

const NOTHING_ENABLED: NotificationPreferences = {
  pushEnabled: false,
  emailEnabled: false,
  jobUpdates: false,
  messages: false,
  newRequests: false,
  reminders: false,
};

/** A kept request of a deleted customer: the approximate pin takes the exact point's place. */
const ANONYMISED_REQUEST: PipelineStage[] = [
  {
    $set: {
      'location.point': '$publicPoint',
      'location.addressLine': '',
      'location.details': null,
      notes: null,
      cancellationComment: null,
      photos: [],
    },
  },
  { $unset: 'clientRequestId' },
];

/**
 * Unique, and not guessable: ids are public, so `deleted-<id>@…` alone could be registered by
 * someone before the deletion and make it fail on the unique email index.
 */
function placeholderEmail(userId: Types.ObjectId): string {
  return `deleted-${userId.toHexString()}-${randomBytes(6).toString('hex')}@deleted.invalid`;
}

/** Drafts deleted, every other request anonymised; the photos of all of them go. Reviews lose their comments. */
export async function eraseCustomerData(deps: ErasureDeps, customerId: Types.ObjectId, tx: Tx): Promise<void> {
  const { session } = tx;
  const requests = await RequestModel.find({ customer: customerId }, { photos: 1 }).session(session).lean<Pick<RequestDoc, 'photos'>[]>();
  discardAfterCommit(deps, tx, requests.flatMap((request) => publicIdsOf(request.photos)));
  await RequestModel.deleteMany({ customer: customerId, status: 'draft' }, { session });
  await RequestModel.updateMany({ customer: customerId }, ANONYMISED_REQUEST, { session, updatePipeline: true });
  await ReviewModel.updateMany({ customer: customerId, comment: { $ne: null } }, { $set: { comment: null } }, { session });
}

/**
 * The public profile becomes a tombstone: out of every search and match (no categories, `deletedAt`
 * filters), its exact base replaced by the approximate one. Offers lose their messages.
 */
export async function eraseProfessionalData(deps: ErasureDeps, professionalId: Types.ObjectId, now: Date, tx: Tx): Promise<void> {
  const { session } = tx;
  const pro = await ProfessionalModel.findById(professionalId, { 'serviceArea.publicCenter': 1 })
    .session(session)
    .lean<Pick<ProfessionalDoc, 'serviceArea'>>();
  if (!pro) throw new Error(`Professional ${professionalId.toHexString()} is missing`);
  await ProfessionalModel.updateOne(
    { _id: professionalId },
    {
      $set: {
        deletedAt: now,
        displayName: DELETED_USER_NAME,
        headline: '',
        bio: '',
        categoryIds: [],
        'serviceArea.center': pro.serviceArea.publicCenter,
        'serviceArea.label': '',
        baseLocation: null,
        contact: { phone: '', email: '', website: null },
        business: { businessName: null, licenseNumber: null, isInsured: false, languages: [] },
        startingPrice: null,
      },
    },
    { session },
  );
  // Not an edit of the offers: their `updatedAt` (a list's sort key) stays.
  await OfferModel.updateMany({ professional: professionalId, message: { $ne: null } }, { $set: { message: null } }, { session, timestamps: false });
  tx.afterCommit(() => invalidatePublicProfessionalProfile(deps, professionalId));
}

/**
 * Both roles: every chat closed, the user's notifications and email links deleted, every session
 * (and push token) revoked, and the account reduced to its tombstone. Returns what the
 * confirmation email needs.
 */
export async function eraseAccount(deps: ErasureDeps, userId: Types.ObjectId, tx: Tx): Promise<ErasedAccount> {
  const { session } = tx;
  await ConversationModel.updateMany({ 'participants.user': userId, isOpen: true }, { $set: { isOpen: false } }, { session });
  await NotificationModel.deleteMany({ user: userId }, { session });
  await EmailTokenModel.deleteMany({ user: userId }, { session });
  await revokeAllSessions(deps, userId, tx);
  const before = await UserModel.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        email: placeholderEmail(userId),
        firstName: '',
        lastName: '',
        phone: '',
        avatar: null,
        defaultLocation: null,
        notificationPreferences: NOTHING_ENABLED,
      },
      $unset: { passwordHash: 1, googleSub: 1, emailVerifiedAt: 1, termsAcceptance: 1 },
    },
    { session, projection: { email: 1, firstName: 1, language: 1, avatar: 1 }, returnDocument: 'before' },
  ).lean<Pick<UserDoc, 'email' | 'firstName' | 'language' | 'avatar'>>();
  if (!before) throw new Error(`User ${userId.toHexString()} is missing`);
  const avatarId = before.avatar?.publicId;
  if (avatarId) tx.afterCommit(() => deps.background.run('discard-avatar', () => discardImages(deps, [avatarId])));
  return { email: before.email, firstName: before.firstName, language: before.language };
}
