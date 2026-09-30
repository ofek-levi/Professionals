/**
 * Authentication of the test double: `Authorization: Bearer <access token>` of a live session
 * (see `sessions.ts`), resolved to the caller ("actor") with their role profile.
 */
import { DomainError } from '@/features/shared/domain-error';
import type { CustomerProfile, OwnProfessionalProfile, UserRole } from '@/types/domain';

import type { MockDatabase, StoredUser } from './db';
import { sessionOfAccessToken } from './sessions';

interface ActorBase {
  userId: string;
  user: StoredUser;
  /** The session of the access token (a push token registered with it goes away on logout). */
  sessionId: string;
}

export interface CustomerActor extends ActorBase {
  role: 'customer';
  customerProfile: CustomerProfile;
}

export interface ProfessionalActor extends ActorBase {
  role: 'professional';
  /** The professional's own profile (its `id` is used by offers/jobs/reviews). */
  professional: OwnProfessionalProfile;
}

export type Actor = CustomerActor | ProfessionalActor;

/** Bearer token from the `Authorization` header (case-insensitive), if any. */
export function readBearerToken(headers: Record<string, string> | undefined): string | null {
  if (!headers) return null;
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'authorization');
  if (!entry) return null;
  const match = /^Bearer\s+(.+)$/i.exec(entry[1].trim());
  return match ? match[1].trim() : null;
}

/** Builds the actor of a session, or `null` when the user or their role profile does not exist. */
function actorFor(db: MockDatabase, userId: string, sessionId: string): Actor | null {
  const user = db.users.get(userId);
  if (!user) return null;
  if (user.role === 'customer') {
    const customerProfile = db.customerProfiles.get(user.id);
    return customerProfile ? { role: 'customer', userId: user.id, user, sessionId, customerProfile } : null;
  }
  const professional = db.professionals.find((profile) => profile.userId === user.id);
  return professional ? { role: 'professional', userId: user.id, user, sessionId, professional } : null;
}

function actorOfToken(db: MockDatabase, token: string, now: Date): Actor | null {
  const session = sessionOfAccessToken(db, token, now);
  return session ? actorFor(db, session.userId, session.id) : null;
}

/**
 * Resolves the caller. No `Authorization` header → `null` (anonymous); a malformed, expired or
 * revoked token → 401 (the app refreshes and retries once).
 */
export function authenticate(db: MockDatabase, headers: Record<string, string> | undefined, now: Date): Actor | null {
  const token = readBearerToken(headers);
  if (token === null) return null;
  const actor = actorOfToken(db, token, now);
  if (!actor) throw DomainError.unauthorized('Invalid or expired access token');
  return actor;
}

/** Like `authenticate`, but an invalid token is treated as anonymous (for public endpoints). */
export function authenticateOptional(db: MockDatabase, headers: Record<string, string> | undefined, now: Date): Actor | null {
  const token = readBearerToken(headers);
  return token ? actorOfToken(db, token, now) : null;
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
