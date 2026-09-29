/** `User` DTO mapper (auth sessions, `/me`, profile responses). */
import { fullName } from '../../lib/text.js';
import type { User } from '../../shared/contract/index.js';
import type { UserDoc } from './user.model.js';

export type UserForView = Pick<UserDoc, '_id' | 'role' | 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar' | 'language' | 'createdAt'>;

/** Projection that loads exactly what `toUserDto` reads. */
export const USER_VIEW_PROJECTION = {
  role: 1,
  firstName: 1,
  lastName: 1,
  email: 1,
  phone: 1,
  avatar: 1,
  language: 1,
  createdAt: 1,
} as const;

/**
 * `displayName` is the professional profile's display name for professionals (pass it), the
 * full name otherwise.
 */
export function toUserDto(user: UserForView, professionalDisplayName?: string | null): User {
  return {
    id: user._id.toHexString(),
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: professionalDisplayName ?? fullName(user),
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatar?.url ?? null,
    preferredLanguage: user.language,
    createdAt: user.createdAt.toISOString(),
  };
}
