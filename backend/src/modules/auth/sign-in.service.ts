/** The last step of every sign-in (password, Google, registration): a new session for the user. */
import type { ClientSession, Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { AuthSession } from '../../shared/contract/index.js';
import { ProfessionalModel } from '../professionals/professional.model.js';
import type { UserForView } from '../users/user.views.js';
import { toAuthSession } from './auth.views.js';
import { startSession } from './session.service.js';

/** A professional's `User.displayName` is their profile's display name. */
export async function professionalDisplayName(userId: Types.ObjectId): Promise<string | null> {
  const profile = await ProfessionalModel.findById(userId, { displayName: 1 }).lean();
  return profile?.displayName ?? null;
}

export async function signIn(deps: Pick<AppDeps, 'env' | 'clock'>, user: UserForView, session?: ClientSession): Promise<AuthSession> {
  const displayName = user.role === 'professional' ? await professionalDisplayName(user._id) : null;
  const tokens = await startSession(deps, user, session);
  return toAuthSession(tokens, user, displayName);
}
