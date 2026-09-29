/**
 * Rules for new passwords (sign-up, reset), ported from the app's `newPasswordIssue`
 * (`frontend/src/lib/validation/auth.ts`, parity-tested): 8–64 characters, at least one letter and
 * one digit, not one of the most common passwords. Passwords are never trimmed. The server adds
 * one rule the app cannot check: not found in a known data breach.
 */
import type { AppDeps } from '../../deps.js';
import { ApiError } from '../../lib/errors.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { vm, type ValidationMessage } from '../../shared/validation-messages.js';

/** Latin (incl. accented), Cyrillic, Hebrew and Arabic letters (same classes as the app). */
export const NAME_LETTER = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u0400-\\u04FF\\u05D0-\\u05EA\\u0620-\\u064A';
const LETTER_PATTERN = new RegExp(`[${NAME_LETTER}]`);
const DIGIT_PATTERN = /\d/;

/**
 * Passwords that pass the length and letter + digit rules but are among the first ones guessed
 * (compared case-insensitively). Same list as the app.
 */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'demo1234',
  'password1',
  'password12',
  'password123',
  'password1234',
  'passw0rd',
  'p4ssw0rd',
  'pa55word',
  'pa55w0rd',
  'qwerty12',
  'qwerty123',
  'qwerty1234',
  'qwertyuiop1',
  'abc12345',
  'abcd1234',
  'abc123456',
  'a1234567',
  'a12345678',
  'a123456789',
  '1234567a',
  '12345678a',
  '123456789a',
  '1q2w3e4r',
  '1q2w3e4r5t',
  'q1w2e3r4',
  'q1w2e3r4t5',
  'zaq12wsx',
  '1qaz2wsx',
  'iloveyou1',
  'letmein1',
  'welcome1',
  'welcome123',
  'admin123',
  'admin1234',
  'sunshine1',
  'princess1',
  'football1',
  'monkey123',
  'dragon123',
  'superman1',
  'shalom123',
  'israel123',
]);

/** The i18n key of the first broken rule, or `null` when `password` is acceptable. */
export function newPasswordIssue(password: string): ValidationMessage | null {
  if (password.length === 0) return vm('auth.passwordRequired');
  if (password.length < APP_CONFIG.passwordMinLength) return vm('auth.passwordTooShort');
  if (password.length > APP_CONFIG.passwordMaxLength) return vm('auth.passwordTooLong');
  if (!LETTER_PATTERN.test(password) || !DIGIT_PATTERN.test(password)) return vm('auth.passwordLetterAndNumber');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return vm('auth.passwordTooCommon');
  return null;
}

/** Same message as a too-common password: for the user both mean "easy to guess". */
export async function assertPasswordNotBreached(deps: Pick<AppDeps, 'passwordBreach'>, password: string): Promise<void> {
  if (await deps.passwordBreach.isBreached(password)) {
    throw ApiError.validation({ password: [vm('auth.passwordTooCommon')] }, 'This password appeared in a data breach');
  }
}
