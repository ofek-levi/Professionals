/** `GET /me` (the account + its role profile) and `PATCH /me` (the account's language). */
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CurrentUserResponse } from '../../shared/contract/index.js';
import type { AppLanguage } from '../../shared/domain.js';
import { loadCustomerStats, toCustomerProfileDto } from '../customers/customer-profile.views.js';
import { ProfessionalModel, type ProfessionalDoc } from '../professionals/professional.model.js';
import { toOwnProfessionalProfile } from '../professionals/professional.views.js';
import { UserModel, type UserDoc } from './user.model.js';
import { USER_VIEW_PROJECTION, toUserDto, type UserForView } from './user.views.js';

type CurrentUser = UserForView & Pick<UserDoc, 'notificationPreferences' | 'defaultLocation' | 'updatedAt' | 'emailVerifiedAt'>;

const CURRENT_USER_PROJECTION = { ...USER_VIEW_PROJECTION, notificationPreferences: 1, defaultLocation: 1, updatedAt: 1, emailVerifiedAt: 1 } as const;

export function accountGone(): ApiError {
  // 401 (not 404): the token outlived its account, so the app signs out.
  return ApiError.unauthorized('The account no longer exists');
}

export async function getCurrentUser(auth: AuthContext): Promise<CurrentUserResponse> {
  const userQuery = UserModel.findById(auth.userId, CURRENT_USER_PROJECTION).lean<CurrentUser>();
  // The role is in the token, so the role data loads in parallel with the user.
  if (auth.role === 'customer') {
    const [user, stats] = await Promise.all([userQuery, loadCustomerStats(auth.userId)]);
    if (!user) throw accountGone();
    return {
      user: { ...toUserDto(user), role: 'customer' },
      emailVerified: Boolean(user.emailVerifiedAt),
      customerProfile: toCustomerProfileDto(user, stats),
      professionalProfile: null,
    };
  }
  const [user, professional] = await Promise.all([userQuery, ProfessionalModel.findById(auth.userId).lean<ProfessionalDoc>()]);
  if (!user) throw accountGone();
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
  const { matchedCount } = await UserModel.updateOne({ _id: auth.userId }, { $set: { language } });
  if (matchedCount === 0) throw accountGone();
}
