/**
 * Payloads of `/auth/*`. `registerBody` mirrors the app's `registerRequestSchema` rule for rule
 * (parity-tested against the app's schema).
 */
import { z } from 'zod';

import { SUPPORTED_LANGUAGES, USER_ROLES } from '../../shared/domain.js';
import { vm } from '../../shared/validation-messages.js';
import {
  authEmailSchema,
  nullableText,
  personNameSchema,
  phoneSchema,
  serviceLocationInputSchema,
  serviceRadiusSchema,
  SIGN_UP_LIMITS,
  signUpCategoryIdsSchema,
} from './auth-fields.schemas.js';
import { newPasswordIssue } from './password-rules.js';

/** Opaque tokens we issue are 43 base64url characters; anything far longer is garbage. */
const opaqueToken = z.string({ error: vm('required') }).trim().min(1, vm('required')).max(200, vm('invalid'));

const professionalSignUpDetails = z.object({
  businessName: nullableText(SIGN_UP_LIMITS.businessNameMax, vm('profile.businessNameTooLong')),
  categoryIds: signUpCategoryIdsSchema,
  baseLocation: serviceLocationInputSchema,
  serviceRadiusKm: serviceRadiusSchema,
});

export const registerBody = z
  .object({
    role: z.enum(USER_ROLES, { error: vm('auth.roleRequired') }),
    firstName: personNameSchema('auth.firstNameRequired'),
    lastName: personNameSchema('auth.lastNameRequired'),
    email: authEmailSchema,
    phone: phoneSchema,
    password: z.string({ error: vm('auth.passwordRequired') }).nullable(),
    googleIdToken: z.string({ error: vm('auth.googleSignInRequired') }).trim().max(4096, vm('invalid')).nullable(),
    acceptedTerms: z.literal(true, { error: vm('auth.termsRequired') }),
    preferredLanguage: z.enum(SUPPORTED_LANGUAGES, { error: vm('invalid') }),
    professional: professionalSignUpDetails.nullable(),
  })
  .superRefine(
    (values, ctx) => {
      // Runs even when other fields are invalid, so every problem is reported at once.
      const password = typeof values.password === 'string' ? values.password : null;
      const googleIdToken = typeof values.googleIdToken === 'string' && values.googleIdToken.trim() ? values.googleIdToken : null;
      if (password !== null && googleIdToken !== null) {
        ctx.addIssue({ code: 'custom', path: ['googleIdToken'], message: vm('invalid') });
      } else if (googleIdToken === null) {
        const issue = newPasswordIssue(password ?? '');
        if (issue) ctx.addIssue({ code: 'custom', path: ['password'], message: issue });
      }
      if (values.role === 'professional' && !values.professional) {
        ctx.addIssue({ code: 'custom', path: ['professional'], message: vm('auth.professionalDetailsRequired') });
      }
      if (values.role === 'customer' && values.professional) {
        ctx.addIssue({ code: 'custom', path: ['professional'], message: vm('invalid') });
      }
    },
    { when: () => true },
  );
export type RegisterInput = z.output<typeof registerBody>;

export const loginBody = z.object({
  email: authEmailSchema,
  password: z.string({ error: vm('auth.passwordRequired') }).min(1, vm('auth.passwordRequired')).max(1024, vm('invalid')),
});
export type LoginInput = z.output<typeof loginBody>;

export const googleBody = z.object({
  idToken: z.string({ error: vm('auth.googleSignInRequired') }).trim().min(1, vm('auth.googleSignInRequired')).max(4096, vm('invalid')),
});

export const refreshBody = z.object({ refreshToken: opaqueToken });

/** The refresh token is optional: a valid bearer token identifies the session too. */
export const logoutBody = z.object({ refreshToken: opaqueToken.optional() });

export const passwordResetBody = z.object({ email: authEmailSchema });

/** `POST /auth/reset-password` as JSON (the HTML form also sends `confirmPassword`). */
export const resetPasswordBody = z.object({
  token: opaqueToken,
  password: z.string({ error: vm('auth.passwordRequired') }).superRefine((value, ctx) => {
    const issue = newPasswordIssue(value);
    if (issue) ctx.addIssue({ code: 'custom', message: issue });
  }),
});
export type ResetPasswordInput = z.output<typeof resetPasswordBody>;
