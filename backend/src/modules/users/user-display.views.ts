/**
 * Batch loader of how users appear to others (conversation participants, reviewers, notification
 * names): two queries for any number of users.
 */
import type { Types } from 'mongoose';

import { loadByIds } from '../../lib/batch.js';
import { customerShortName, DELETED_USER_NAME, fullName } from '../../lib/text.js';
import type { UserRole } from '../../shared/domain.js';
import { ProfessionalModel } from '../professionals/professional.model.js';
import { UserModel, type UserDoc } from './user.model.js';

export interface UserDisplay {
  role: UserRole;
  /** Professionals: profile display name; customers: full name. */
  displayName: string;
  /** What professionals and reviews show for a customer ("Noa L."); professionals: display name. */
  shortName: string;
  avatarUrl: string | null;
  /** A deleted account: both names are `DELETED_USER_NAME`. */
  accountDeleted: boolean;
}

type DisplayUser = Pick<UserDoc, '_id' | 'role' | 'firstName' | 'lastName' | 'avatar' | 'deletedAt'>;

function toUserDisplay(user: DisplayUser, professionalName: string | undefined): UserDisplay {
  if (user.deletedAt) return { role: user.role, displayName: DELETED_USER_NAME, shortName: DELETED_USER_NAME, avatarUrl: null, accountDeleted: true };
  const displayName = professionalName ?? fullName(user);
  return {
    role: user.role,
    displayName,
    shortName: user.role === 'customer' ? customerShortName(user) : displayName,
    avatarUrl: user.avatar?.url ?? null,
    accountDeleted: false,
  };
}

export async function loadUserDisplays(userIds: Iterable<Types.ObjectId>): Promise<Map<string, UserDisplay>> {
  const users = await loadByIds<UserDoc, DisplayUser>(UserModel, userIds, { role: 1, firstName: 1, lastName: 1, avatar: 1, deletedAt: 1 });
  const professionalIds = [...users.values()].filter((user) => user.role === 'professional').map((user) => user._id);
  const professionals = await loadByIds(ProfessionalModel, professionalIds, { displayName: 1 });
  return new Map([...users].map(([id, user]) => [id, toUserDisplay(user, professionals.get(id)?.displayName)]));
}
