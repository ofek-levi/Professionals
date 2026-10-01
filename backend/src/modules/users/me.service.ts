/** `GET /me` (the account + its role profile) and `PATCH /me` (the account's language). */
import type { ClientSession, Types } from 'mongoose';

import type { Tx } from '../../infra/mongo.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CurrentUserResponse } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { loadCustomerStats, toCustomerProfileDto } from '../customers/customer-profile.views.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { toOwnProfessionalProfile } from '../professionals/professional.views.js';
import { NOT_DELETED, UserModel, type UserDoc } from './user.model.js';
import { USER_VIEW_PROJECTION, toUserDto, type UserForView } from './user.views.js';

type CurrentUser = UserForView & Pick<UserDoc, 'notificationPreferences' | 'defaultLocation' | 'updatedAt' | 'emailVerifiedAt' | 'deletedAt'>;

const CURRENT_USER_PROJECTION = { ...USER_VIEW_PROJECTION, notificationPreferences: 1, defaultLocation: 1, updatedAt: 1, emailVerifiedAt: 1, deletedAt: 1 } as const;

export function accountGone(): ApiError {
  // 401 (not 404): the token outlived its account, so the app signs out.
  return ApiError.unauthorized('The account no longer exists');
}

/** Refuses a caller whose account is gone (deleted, or never existed). */
export async function assertAccountActive(userId: Types.ObjectId, session?: ClientSession): Promise<void> {
  const user = await UserModel.findOne({ _id: userId, ...NOT_DELETED }, { _id: 1 }).session(session ?? null).lean();
  if (!user) throw accountGone();
}

/**
 * The first statement of a transaction that creates something for `userId` (a request, an offer,
 * a review, a job): refuses an account that is gone, with a conditional write on it. A read would
 * not do: under snapshot isolation it does not conflict with a deletion committing meanwhile (from
 * another device), and what it let through would outlive the deletion. The deletion's first write
 * is on the same document, so the two transactions conflict and the one retried sees the other's
 * result: the account gone, or the new record, which the deletion then handles like any other.
 */
export async function lockActiveAccount(userId: Types.ObjectId, tx: Tx): Promise<void> {
  const { matchedCount } = await UserModel.updateOne({ _id: userId, ...NOT_DELETED }, { $inc: { writeSeq: 1 } }, { session: tx.session, timestamps: false });
  if (matchedCount === 0) throw accountGone();
}

export async function getCurrentUser(auth: AuthContext): Promise<CurrentUserResponse> {
  const userQuery = UserModel.findById(auth.userId, CURRENT_USER_PROJECTION).lean<CurrentUser>();
  // The role is in the token, so the role data loads in parallel with the user.
  if (auth.role === 'customer') {
    const [user, stats] = await Promise.all([userQuery, loadCustomerStats(auth.userId)]);
    if (!user || user.deletedAt) throw accountGone();
    return {
      user: { ...toUserDto(user), role: 'customer' },
      emailVerified: Boolean(user.emailVerifiedAt),
      customerProfile: toCustomerProfileDto(user, stats),
      professionalProfile: null,
    };
  }
  const [user, professional] = await Promise.all([userQuery, ProfessionalModel.findById(auth.userId).lean<ProfessionalDoc>()]);
  if (!user || user.deletedAt) throw accountGone();
  if (!professional) throw ApiError.notFound('Professional profile');
  return {
    user: { ...toUserDto(user, professional.displayName), role: 'professional' },
    emailVerified: Boolean(user.emailVerifiedAt),
    customerProfile: null,
    professionalProfile: toOwnProfessionalProfile(professional, user),
  };
}

/** The language of push notifications and emails follows the app's language setting. */
export async function updateLanguage(auth: AuthContext, language: AppLanguage): Promise<void> {
  const { matchedCount } = await UserModel.updateOne({ _id: auth.userId, ...NOT_DELETED }, { $set: { language } });
  if (matchedCount === 0) throw accountGone();
}
