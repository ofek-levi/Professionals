/**
 * zod building blocks shared by the customer and professional profile PATCHes, ported from the
 * app's `frontend/src/lib/validation/profile.ts` (same limits and `validation:*` messages). Location,
 * phone and category blocks come from the account schemas (`auth/auth-fields.schemas.ts`).
 */
import { z } from 'zod';

import { vm, type ValidationMessage } from '../../shared/validation-messages.js';

export const PROFILE_LIMITS = {
  nameMax: 60,
  displayNameMax: 60,
  headlineMax: 80,
  bioMin: 30,
  bioMax: 1000,
  businessNameMax: 80,
  licenseNumberMax: 30,
  maxCategories: 10,
  maxYearsOfExperience: 60,
  maxLanguages: 20,
  urlMax: 2048,
} as const;

interface TextRule {
  min?: number;
  max: number;
  required: ValidationMessage;
  tooShort?: ValidationMessage;
  tooLong: ValidationMessage;
}

/** Trimmed text with one message per rule (never two messages for one value). */
export function profileText({ min = 1, max, required, tooShort, tooLong }: TextRule) {
  return z
    .string({ error: required })
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) ctx.addIssue({ code: 'custom', message: required });
      else if (value.length < min) ctx.addIssue({ code: 'custom', message: tooShort ?? required });
      else if (value.length > max) ctx.addIssue({ code: 'custom', message: tooLong });
    });
}

export const personNameSchema = (required: 'profile.firstNameRequired' | 'profile.lastNameRequired') =>
  profileText({ max: PROFILE_LIMITS.nameMax, required: vm(required), tooLong: vm('profile.nameTooLong') });

/** URL returned by `POST /uploads/images` (checked against the caller's uploads), or `null`. */
export const avatarUrlSchema = z.string().trim().min(1, vm('invalid')).max(PROFILE_LIMITS.urlMax, vm('invalid')).nullable();

export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  jobUpdates: z.boolean(),
  messages: z.boolean(),
  newRequests: z.boolean(),
  reminders: z.boolean(),
});
