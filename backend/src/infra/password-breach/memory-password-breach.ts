import type { PasswordBreachChecker } from './password-breach.js';

/** Test double: passwords added to `breached` are reported as found in a breach. */
export class MemoryPasswordBreachChecker implements PasswordBreachChecker {
  readonly breached = new Set<string>();

  isBreached(password: string): Promise<boolean> {
    return Promise.resolve(this.breached.has(password));
  }
}
