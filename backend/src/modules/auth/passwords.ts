/**
 * Password hashing with argon2id. Parameters follow the OWASP recommendation (19 MiB, 2 passes,
 * 1 lane): strong against GPU cracking while keeping a sign-in burst within a small container's
 * memory. Hashes made with older parameters are upgraded on the next successful sign-in.
 */
import argon2 from 'argon2';

const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Verified against when the account does not exist, so every failure takes the same time. */
let dummyHash: Promise<string> | null = null;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

/** `false` for a wrong password, a missing hash (Google-only account) or an unknown account. */
export async function verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
  if (!hash) {
    dummyHash ??= hashPassword('not-the-password-0');
    await argon2.verify(await dummyHash, password);
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // malformed stored hash
  }
}

export function passwordNeedsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, HASH_OPTIONS);
}
