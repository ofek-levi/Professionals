/** `GET`/`PATCH /customer/profile`: the account basics, default address and preferences. */
import type { ClientSession, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { toLocationDoc } from '../../infra/schema-parts.js';
import { withTransaction } from '../../infra/mongo.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CustomerProfileResponse } from '../../shared/contract/index.js';
import { changeAvatar } from '../uploads/avatar.service.js';
import { UserModel, type UserDoc } from '../users/user.model.js';
import { USER_VIEW_PROJECTION, toUserDto, type UserForView } from '../users/user.views.js';
import { loadCustomerStats, toCustomerProfileDto } from './customer-profile.views.js';
import type { UpdateCustomerProfileInput } from './customers.schemas.js';

type CustomerUser = UserForView & Pick<UserDoc, 'defaultLocation' | 'notificationPreferences' | 'updatedAt'>;

const CUSTOMER_PROJECTION = { ...USER_VIEW_PROJECTION, defaultLocation: 1, notificationPreferences: 1, updatedAt: 1 } as const;

/** Loads the stats (unaffected by profile edits) while `user` is read or written. */
async function respond(userId: Types.ObjectId, user: Promise<CustomerUser | null>): Promise<CustomerProfileResponse> {
  const [doc, stats] = await Promise.all([user, loadCustomerStats(userId)]);
  if (!doc) throw ApiError.notFound('Customer profile');
  return { user: toUserDto(doc), profile: toCustomerProfileDto(doc, stats) };
}

export async function getCustomerProfile(auth: AuthContext): Promise<CustomerProfileResponse> {
  return respond(auth.userId, UserModel.findOne({ _id: auth.userId, role: 'customer' }, CUSTOMER_PROJECTION).lean<CustomerUser>());
}

function changesOf(input: UpdateCustomerProfileInput): Partial<UserDoc> {
  const { firstName, lastName, phone, defaultLocation, notificationPreferences } = input;
  return {
    ...(firstName !== undefined ? { firstName } : {}),
    ...(lastName !== undefined ? { lastName } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(defaultLocation !== undefined ? { defaultLocation: defaultLocation ? toLocationDoc(defaultLocation) : null } : {}),
    ...(notificationPreferences !== undefined ? { notificationPreferences } : {}),
  };
}

async function saveCustomer(userId: Types.ObjectId, changes: Partial<UserDoc>, session?: ClientSession): Promise<CustomerUser | null> {
  return UserModel.findOneAndUpdate(
    { _id: userId, role: 'customer' },
    { $set: changes },
    { session, projection: CUSTOMER_PROJECTION, returnDocument: 'after' },
  ).lean<CustomerUser>();
}

export async function updateCustomerProfile(
  deps: Pick<AppDeps, 'clock' | 'logger'>,
  auth: AuthContext,
  input: UpdateCustomerProfileInput,
): Promise<CustomerProfileResponse> {
  const changes = changesOf(input);
  const { avatarUrl } = input;
  if (avatarUrl === undefined) return respond(auth.userId, saveCustomer(auth.userId, changes));
  // The avatar claim and the account write succeed or fail together.
  const saved = withTransaction(deps.logger, async ({ session }) => {
    const current = await UserModel.findOne({ _id: auth.userId, role: 'customer' }, { avatar: 1 }, { session }).lean<Pick<UserDoc, 'avatar'>>();
    if (!current) throw ApiError.notFound('Customer profile');
    const avatar = await changeAvatar(auth.userId, current.avatar, avatarUrl, deps.clock.now(), session);
    return saveCustomer(auth.userId, { ...changes, avatar }, session);
  });
  return respond(auth.userId, saved);
}
