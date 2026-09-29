/** Response mappers of `/auth/*`. */
import type { GoogleIdentity } from '../../infra/google/index.js';
import type { AuthSession, GoogleProfile, RefreshResponse } from '../../shared/contract/index.js';
import { toUserDto, type UserForView } from '../users/user.views.js';

export function toAuthSession(tokens: RefreshResponse, user: UserForView, professionalDisplayName: string | null): AuthSession {
  return { ...tokens, user: toUserDto(user, professionalDisplayName) };
}

export function toGoogleProfile(identity: GoogleIdentity): GoogleProfile {
  return { email: identity.email, firstName: identity.firstName, lastName: identity.lastName, avatarUrl: identity.avatarUrl };
}
