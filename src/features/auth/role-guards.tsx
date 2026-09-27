/**
 * Route guards by session state and role. Layouts use them to keep customers out of professional
 * screens (and vice versa) and signed-out users out of the app.
 */
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import type { UserRole } from '@/types/domain';

import { resolveRoleAccess, type RoleAccess } from './role-access';
import { useSession } from './session-provider';

export { resolveRoleAccess, type RoleAccess };

/** Access decision for the current session and `role` (`'any'` = any signed-in user). */
export function useRequireRole(role: UserRole | 'any'): RoleAccess {
  return resolveRoleAccess(useSession(), role);
}

export interface RequireRoleProps {
  role: UserRole | 'any';
  children: ReactNode;
}

/** Renders `children` only for a signed-in user with `role`; redirects otherwise. */
export function RequireRole({ role, children }: RequireRoleProps) {
  const access = useRequireRole(role);
  if (access.state === 'pending') return null;
  if (access.state === 'redirect') return <Redirect href={access.href} />;
  return <>{children}</>;
}
