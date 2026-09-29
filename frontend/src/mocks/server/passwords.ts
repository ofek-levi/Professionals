/**
 * Password hashing of the mock backend: salted SHA-256 (pure JS, deterministic, works on every
 * runtime). Good enough to never keep plaintext passwords in the on-device demo database; a real
 * backend hashes server-side with a slow, memory-hard KDF (argon2id, bcrypt or scrypt).
 */
import { sha256Hex } from '@/utils/sha256';

/** Password of every seeded account (shown as a hint on the sign-in screen in mock mode). */
export const DEMO_ACCOUNT_PASSWORD = 'Demo1234';

/** The demo account the sign-in screen suggests for trying email sign-in (the first demo customer). */
export const DEMO_SIGN_IN_EMAIL = 'noa.levi@example.com';

const SCHEME = 'sha256';
const SALT_ALPHABET = '0123456789abcdef';
const SALT_LENGTH = 16;

/** Random per-credential salt (Math.random is fine for an on-device demo database). */
export function createSalt(): string {
  let salt = '';
  for (let i = 0; i < SALT_LENGTH; i += 1) salt += SALT_ALPHABET[Math.floor(Math.random() * SALT_ALPHABET.length)];
  return salt;
}

/** Stored form of a password: `sha256$<salt>$<hex digest of "<salt>:<password>">`. */
export function hashPassword(password: string, salt: string = createSalt()): string {
  return `${SCHEME}$${salt}$${sha256Hex(`${salt}:${password}`)}`;
}

/** Compares without an early exit on the first differing character. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== SCHEME || !salt || !digest) return false;
  return constantTimeEquals(sha256Hex(`${salt}:${password}`), digest);
}
