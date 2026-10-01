/**
 * How the operator commands (`src/delete-account.ts`, `export-account.ts`, `change-email.ts`) name
 * an account: by its sign-in email, in any case, or by its id (the `account deleted` log lines and
 * the exports name ids).
 */
import { Types } from 'mongoose';

import { isObjectIdString } from '../../lib/ids.js';
import { NOT_DELETED, UserModel, type UserDoc } from './user.model.js';

export function accountFilter(emailOrId: string): { _id: Types.ObjectId } | { email: string } {
  const key = emailOrId.trim();
  // `isObjectIdString` guards `string`, which leaves `key` typed `never` in the email branch.
  return isObjectIdString(key) ? { _id: new Types.ObjectId(key) } : { email: emailOrId.trim().toLowerCase() };
}

/** The account (not deleted) with this sign-in email or id, with the `projection` fields; `null` when there is none. */
export function findActiveAccount<T extends Pick<UserDoc, '_id'>>(emailOrId: string, projection: Record<string, 0 | 1>): Promise<T | null> {
  return UserModel.findOne({ ...accountFilter(emailOrId), ...NOT_DELETED }, projection).lean<T>().exec();
}
