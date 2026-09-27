/**
 * Route guards by session state and role. Layouts use them to keep customers out of professional
 * screens (and vice versa) and signed-out users out of the app.
 */
import type { UserRole } from '@/types/domain';

import { resolveRoleAccess, type RoleAccess } from './role-access';
import { useSession } from './session-provider';

export { resolveRoleAccess, type RoleAccess };

/** Access decision for the current session and `role` (`'any'` = any signed-in user). */
export function useRequireRole(role: UserRole | 'any'): RoleAccess {
  return resolveRoleAccess(useSession(), role);
}
