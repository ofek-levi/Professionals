import type { Env } from '../../config/env.js';
import type { Logger } from '../../lib/logger.js';
import { DisabledPasswordBreachChecker, PwnedPasswordsChecker, type PasswordBreachChecker } from './password-breach.js';

export type { PasswordBreachChecker } from './password-breach.js';
export { MemoryPasswordBreachChecker } from './memory-password-breach.js';

export function createPasswordBreachChecker(env: Env, logger: Logger): PasswordBreachChecker {
  return env.passwordBreachCheck ? new PwnedPasswordsChecker(logger, `ProfessionalsAPI (${env.appEnv})`) : new DisabledPasswordBreachChecker();
}
