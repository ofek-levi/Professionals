/**
 * Password hashing of the test double: salted SHA-256 (pure JS, deterministic, fast in Jest). The
 * real backend hashes with argon2id; only the observable behaviour (same answer for an unknown email
 * and a wrong password) matters here.
 */
import { sha256Hex } from './sha256';

/** Password of every seeded account. */
export const SEED_PASSWORD = 'Fixture123';

/** Email of the first main customer, Noa (tests sign in with it). */
export const SEED_CUSTOMER_EMAIL = 'noa.levi@example.com';

const SCHEME = 'sha256';
const SALT_ALPHABET = '0123456789abcdef';
const SALT_LENGTH = 16;

/** Random per-credential salt (Math.random is fine for a test double). */
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
