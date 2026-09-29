/**
 * Breached-password check (BACKEND_INTEGRATION.md §3) with the Pwned Passwords k-anonymity range
 * API: only the first 5 hex characters of the password's SHA-1 leave the server, and the answer is
 * padded so its size reveals nothing either. It fails open: an outage of the service must not
 * block sign-ups or resets, so errors are logged and the password is accepted.
 */
import { createHash } from 'node:crypto';

import type { Logger } from '../../lib/logger.js';

export interface PasswordBreachChecker {
  /** `true` when the password appears in a known data breach. */
  isBreached(password: string): Promise<boolean>;
}

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 2_000;

export class PwnedPasswordsChecker implements PasswordBreachChecker {
  constructor(
    private readonly logger: Logger,
    private readonly userAgent: string,
  ) {}

  async isBreached(password: string): Promise<boolean> {
    const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const suffix = hash.slice(5);
    try {
      const response = await fetch(`${RANGE_URL}${hash.slice(0, 5)}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Pwned Passwords answered ${response.status}`);
      // Lines are `SUFFIX:COUNT`; padding lines have a count of 0.
      return (await response.text()).split('\n').some((line) => {
        const [candidate, count] = line.trim().split(':');
        return candidate === suffix && Number(count) > 0;
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'breached-password check unavailable; password accepted');
      return false;
    }
  }
}

/** `PASSWORD_BREACH_CHECK=false` (e.g. a network without access to the service). */
export class DisabledPasswordBreachChecker implements PasswordBreachChecker {
  isBreached(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
