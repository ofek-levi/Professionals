/**
 * Pure helpers of the sign-up flow (steps, where errors are, which step to show).
 */
import { SIGN_UP_STEP_FIELDS, signUpStepsFor, type SignUpField, type SignUpStep } from '@/lib/validation/auth';
import type { UserRole } from '@/types/domain';

/**
 * Index of the first step of a new flow: the account step when the role came with the link (the
 * role step is then not part of the flow – going back from the account step leaves it).
 */
export function initialSignUpStepIndex(role: UserRole | null): number {
  return role ? signUpStepsFor(role).indexOf('account') : 0;
}

export interface SignUpProgress {
  /** 1-based, counted from the first step the user sees. */
  step: number;
  /** `null` until a role is chosen: the length of the flow depends on it. */
  total: number | null;
}

/** What the progress bar shows for step `index` of a flow that started at `firstIndex`. */
export function signUpProgress(steps: readonly SignUpStep[], index: number, firstIndex: number, role: UserRole | null): SignUpProgress {
  return { step: index - firstIndex + 1, total: role ? steps.length - firstIndex : null };
}

/** The first field of `step` (in screen order) that has an error, or `null`. */
export function firstInvalidFieldOfStep(step: SignUpStep, invalidFields: Iterable<string>): SignUpField | null {
  const invalid = new Set(invalidFields);
  return SIGN_UP_STEP_FIELDS[step].find((field) => invalid.has(field)) ?? null;
}

/** The earliest step of the flow showing one of `invalidFields`, or `null` when none of them is shown. */
export function firstInvalidStep(steps: readonly SignUpStep[], invalidFields: Iterable<string>): SignUpStep | null {
  const invalid = [...invalidFields];
  return steps.find((step) => firstInvalidFieldOfStep(step, invalid) !== null) ?? null;
}
