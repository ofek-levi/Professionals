/**
 * Pure access decision by session state and role (no React / router imports, easy to test).
 */
import type { Href } from 'expo-router';

import { routes } from '@/lib/routes';
import type { SessionState } from '@/services/auth/session-store';
import type { UserRole } from '@/types/domain';

export type RoleAccess =
  | { state: 'pending' }
  | { state: 'granted'; userId: string; role: UserRole }
  | { state: 'redirect'; href: Href };

/**
 * Pure access decision:
 * - session still loading → `pending` (render nothing, the splash screen is still visible)
 * - signed out → redirect to sign-in
 * - signed in with another role → redirect to that role's home
 */
export function resolveRoleAccess(
  session: Pick<SessionState, 'status' | 'userId' | 'role'>,
  required: UserRole | 'any',
): RoleAccess {
  if (session.status === 'loading') return { state: 'pending' };
  if (session.status === 'signedOut' || !session.userId || !session.role) {
    return { state: 'redirect', href: routes.signIn };
  }
  if (required !== 'any' && session.role !== required) {
    return { state: 'redirect', href: routes.homeFor(session.role) };
  }
  return { state: 'granted', userId: session.userId, role: session.role };
}
