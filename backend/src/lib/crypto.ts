/** Random tokens and hashing for refresh tokens, email links and similar opaque secrets. */
import { createHash, randomBytes } from 'node:crypto';

/** URL-safe random token (`bytes` of entropy, 32 = 256 bits). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 digest (base64url). Tokens are stored only as this hash. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
