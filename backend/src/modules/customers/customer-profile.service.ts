/** `GET`/`PATCH /customer/profile`: the account basics, default address and preferences. */
import type { Types } from 'mongoose';

import { toLocationDoc } from '../../infra/schema-parts.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import type { CustomerProfileResponse } from '../../shared/contract/index.js';
import { NOT_DELETED, UserModel, type UserDoc } from '../users/user.model.js';
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
  return respond(auth.userId, UserModel.findOne({ _id: auth.userId, role: 'customer', ...NOT_DELETED }, CUSTOMER_PROJECTION).lean<CustomerUser>());
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

export async function updateCustomerProfile(auth: AuthContext, input: UpdateCustomerProfileInput): Promise<CustomerProfileResponse> {
  const saved = UserModel.findOneAndUpdate(
    { _id: auth.userId, role: 'customer', ...NOT_DELETED },
    { $set: changesOf(input) },
    { projection: CUSTOMER_PROJECTION, returnDocument: 'after' },
  ).lean<CustomerUser>();
  return respond(auth.userId, saved);
}
