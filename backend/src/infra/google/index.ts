import type { Env } from '../../config/env.js';
import { GoogleAuthVerifier, type GoogleVerifier, UnconfiguredGoogleVerifier } from './google-verifier.js';

export type { GoogleIdentity, GoogleVerifier } from './google-verifier.js';
export { MemoryGoogleVerifier } from './memory-google-verifier.js';

export function createGoogleVerifier(env: Env): GoogleVerifier {
  return env.googleClientIds.length > 0 ? new GoogleAuthVerifier(env.googleClientIds) : new UnconfiguredGoogleVerifier();
}
