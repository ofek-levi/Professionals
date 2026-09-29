/**
 * Mock authentication. Access tokens are `demo-token:<userId>` (a real backend would issue JWTs).
 */
import { DomainError } from '@/features/shared/domain-error';
import type { CustomerProfile, OwnProfessionalProfile, UserRole } from '@/types/domain';

import type { MockDatabase, StoredUser } from './db';

const DEMO_TOKEN_PREFIX = 'demo-token:';

export interface CustomerActor {
  role: 'customer';
  userId: string;
  user: StoredUser;
  customerProfile: CustomerProfile;
}

export interface ProfessionalActor {
  role: 'professional';
  userId: string;
  user: StoredUser;
  /** The professional's own profile (its `id` is used by offers/jobs/reviews). */
  professional: OwnProfessionalProfile;
}

export type Actor = CustomerActor | ProfessionalActor;

export function createAccessToken(userId: string): string {
  return `${DEMO_TOKEN_PREFIX}${userId}`;
}

/** User id encoded in a demo token, or `null` for anything else. */
export function parseAccessToken(token: string): string | null {
  if (!token.startsWith(DEMO_TOKEN_PREFIX)) return null;
  const userId = token.slice(DEMO_TOKEN_PREFIX.length).trim();
  return userId.length > 0 ? userId : null;
}

/** Bearer token from the `Authorization` header (case-insensitive), if any. */
function readBearerToken(headers: Record<string, string> | undefined): string | null {
  if (!headers) return null;
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'authorization');
  if (!entry) return null;
  const match = /^Bearer\s+(.+)$/i.exec(entry[1].trim());
  return match ? match[1].trim() : null;
}

/** Builds the actor for a user id, or `null` when the user or their role profile does not exist. */
export function actorForUserId(db: MockDatabase, userId: string): Actor | null {
  const user = db.users.get(userId);
  if (!user) return null;
  if (user.role === 'customer') {
    const customerProfile = db.customerProfiles.get(user.id);
    return customerProfile ? { role: 'customer', userId: user.id, user, customerProfile } : null;
  }
  const professional = db.professionals.find((profile) => profile.userId === user.id);
  return professional ? { role: 'professional', userId: user.id, user, professional } : null;
}

/**
 * Resolves the caller. No `Authorization` header → `null` (anonymous);
 * a malformed or unknown token → 401.
 */
export function authenticate(db: MockDatabase, headers: Record<string, string> | undefined): Actor | null {
  const token = readBearerToken(headers);
  if (token === null) return null;
  const userId = parseAccessToken(token);
  const actor = userId ? actorForUserId(db, userId) : null;
  if (!actor) throw DomainError.unauthorized('Invalid or expired access token');
  return actor;
}

/** Like `authenticate`, but an invalid token is treated as anonymous (for public endpoints). */
export function authenticateOptional(db: MockDatabase, headers: Record<string, string> | undefined): Actor | null {
  const token = readBearerToken(headers);
  const userId = token ? parseAccessToken(token) : null;
  return userId ? actorForUserId(db, userId) : null;
}

export function requireUser(actor: Actor | null): Actor {
  if (!actor) throw DomainError.unauthorized();
  return actor;
}

export function requireRole<R extends UserRole>(actor: Actor | null, role: R): Extract<Actor, { role: R }> {
  const user = requireUser(actor);
  if (user.role !== role) throw DomainError.forbidden(`This endpoint is only available to ${role}s`);
  return user as Extract<Actor, { role: R }>;
}
