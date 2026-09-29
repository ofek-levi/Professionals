/**
 * Signed-in callers for tests: a user of the wanted role plus a valid access token for the test
 * app's JWT settings and clock (no session document: refresh flows are tested by the auth module).
 */
import { Types } from 'mongoose';

import { signAccessToken } from '../src/lib/access-token.js';
import type { UserDoc } from '../src/modules/users/user.model.js';
import type { TestDeps } from './app.js';
import { createCustomer, createProfessional, type TestProfessional } from './factories.js';

export function accessTokenFor(deps: Pick<TestDeps, 'env' | 'clock'>, user: Pick<UserDoc, '_id' | 'role'>): string {
  return signAccessToken(
    deps.env.jwt,
    { userId: user._id.toHexString(), role: user.role, sessionId: new Types.ObjectId().toHexString() },
    deps.clock,
  ).token;
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export interface SignedInCustomer {
  user: UserDoc;
  token: string;
  headers: { Authorization: string };
}

export async function signInCustomer(deps: Pick<TestDeps, 'env' | 'clock'>, overrides: Partial<UserDoc> = {}): Promise<SignedInCustomer> {
  const user = await createCustomer(overrides);
  const token = accessTokenFor(deps, user);
  return { user, token, headers: bearer(token) };
}

export interface SignedInProfessional extends TestProfessional {
  token: string;
  headers: { Authorization: string };
}

export async function signInProfessional(
  deps: Pick<TestDeps, 'env' | 'clock'>,
  options: Parameters<typeof createProfessional>[0] = {},
): Promise<SignedInProfessional> {
  const created = await createProfessional(options);
  const token = accessTokenFor(deps, created.user);
  return { ...created, token, headers: bearer(token) };
}
