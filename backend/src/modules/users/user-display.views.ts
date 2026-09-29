/**
 * Batch loader of how users appear to others (conversation participants, reviewers, notification
 * names): two queries for any number of users.
 */
import type { Types } from 'mongoose';

import { loadByIds } from '../../lib/batch.js';
import { customerShortName, fullName } from '../../lib/text.js';
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
}

type DisplayUser = Pick<UserDoc, '_id' | 'role' | 'firstName' | 'lastName' | 'avatar'>;

export async function loadUserDisplays(userIds: Iterable<Types.ObjectId>): Promise<Map<string, UserDisplay>> {
  const users = await loadByIds<UserDoc, DisplayUser>(UserModel, userIds, { role: 1, firstName: 1, lastName: 1, avatar: 1 });
  const professionalIds = [...users.values()].filter((user) => user.role === 'professional').map((user) => user._id);
  const professionals = await loadByIds(ProfessionalModel, professionalIds, { displayName: 1 });
  const result = new Map<string, UserDisplay>();
  for (const [id, user] of users) {
    const professionalName = professionals.get(id)?.displayName;
    const displayName = professionalName ?? fullName(user);
    result.set(id, {
      role: user.role,
      displayName,
      shortName: user.role === 'customer' ? customerShortName(user) : displayName,
      avatarUrl: user.avatar?.url ?? null,
    });
  }
  return result;
}
