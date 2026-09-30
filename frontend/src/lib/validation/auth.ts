/**
 * Auth validation: sign-in, sign-up (per step and as a whole), password reset and the matching REST
 * payloads (`POST /auth/login|register|google|password-reset`). The backend
 * applies the same rules (`backend/src/modules/auth`, parity-tested); the test double validates
 * with these schemas.
 */
import { z } from 'zod';

import { APP_CONFIG } from '@/constants/app-config';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import type { GoogleProfile, LoginRequest, PasswordResetRequest, RegisterRequest } from '@/types/api';
import { SUPPORTED_LANGUAGES, USER_ROLES, type AppLanguage, type CategoryId, type UserRole } from '@/types/domain';

import { categoryIdSchema, isValidEmail, normalizePhone, nullableText, optionalText, phoneSchema, serviceLocationInputSchema } from './common';
import { vm, type ValidationMessageKey } from './messages';
import { PROFILE_LIMITS } from './profile';
import { requestFormLocationSchema, type RequestFormLocation } from './request';

// ────────────────────────────── Building blocks ──────────────────────────────

/** RFC 5321 limit of an email address. */
const EMAIL_MAX_LENGTH = 254;

/** Email issue for a raw value, or `null` when valid. */
function emailIssue(value: string): ValidationMessageKey | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return vm('auth.emailRequired');
  if (trimmed.length > EMAIL_MAX_LENGTH || !isValidEmail(trimmed)) return vm('auth.emailInvalid');
  return null;
}

/** Canonical form of an email address: trimmed and lower-cased (accounts are case-insensitive). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Required, valid email; the parsed value is trimmed and lower-cased. */
export const authEmailSchema = z
  .string({ error: vm('auth.emailRequired') })
  .superRefine((value, ctx) => {
    const issue = emailIssue(value);
    if (issue) ctx.addIssue({ code: 'custom', message: issue });
  })
  .transform(normalizeEmail);

/** Latin (incl. accented), Cyrillic, Hebrew and Arabic letters. */
const NAME_LETTER = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u0400-\\u04FF\\u05D0-\\u05EA\\u0620-\\u064A';
/** Starts with a letter; then letters, spaces, hyphens and apostrophes (', ’, Hebrew geresh ׳). */
const NAME_PATTERN = new RegExp(`^[${NAME_LETTER}][${NAME_LETTER}\\s'’\\u05F3\\-]*$`);
const LETTER_PATTERN = new RegExp(`[${NAME_LETTER}]`);
const DIGIT_PATTERN = /\d/;

/** Name issue for a raw value, or `null` when valid. */
function personNameIssue(value: string, required: ValidationMessageKey): ValidationMessageKey | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return required;
  if (trimmed.length < APP_CONFIG.personNameMinLength) return vm('auth.nameTooShort');
  if (trimmed.length > APP_CONFIG.personNameMaxLength) return vm('auth.nameTooLong');
  if (!NAME_PATTERN.test(trimmed)) return vm('auth.nameInvalid');
  return null;
}

const personNameSchema = (required: 'auth.firstNameRequired' | 'auth.lastNameRequired') =>
  z
    .string({ error: vm(required) })
    .superRefine((value, ctx) => {
      const issue = personNameIssue(value, vm(required));
      if (issue) ctx.addIssue({ code: 'custom', message: issue });
    })
    .transform((value) => value.trim().replace(/\s+/g, ' '));

/**
 * Passwords that pass the length and letter + number rules but are among the first ones guessed.
 * Compared case-insensitively; the same list as the backend's `password-rules.ts`, which also
 * checks new passwords against the Pwned Passwords breach list.
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

/**
 * Password rule for new accounts: 8–64 characters with at least one letter and one number, and not
 * one of the most common passwords. Passwords are never trimmed. Returns an i18n key or `null`.
 */
export function newPasswordIssue(password: string): ValidationMessageKey | null {
  if (password.length === 0) return vm('auth.passwordRequired');
  if (password.length < APP_CONFIG.passwordMinLength) return vm('auth.passwordTooShort');
  if (password.length > APP_CONFIG.passwordMaxLength) return vm('auth.passwordTooLong');
  if (!LETTER_PATTERN.test(password) || !DIGIT_PATTERN.test(password)) return vm('auth.passwordLetterAndNumber');
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return vm('auth.passwordTooCommon');
  return null;
}

const serviceRadiusSchema = z
  .number({ error: vm('invalid') })
  .min(APP_CONFIG.minServiceRadiusKm, vm('profile.radiusTooSmall'))
  .max(APP_CONFIG.maxServiceRadiusKm, vm('profile.radiusTooLarge'));

const businessNameSchema = optionalText(PROFILE_LIMITS.businessNameMax, vm('profile.businessNameTooLong'));

const signUpCategoryIdsSchema = z
  .array(z.string(), { error: vm('category.minOne') })
  .min(1, vm('category.minOne'))
  .max(PROFILE_LIMITS.maxCategories, vm('category.tooMany'))
  .refine((ids) => ids.every((id) => isSupportedCategoryId(id)), { message: vm('category.unsupported') });

type IssueSink = Pick<z.RefinementCtx, 'addIssue'>;

/** Runs `schema` on `value` and reports its issues on `ctx` (paths prefixed with `prefix`). */
function forwardIssues(schema: z.ZodType, value: unknown, ctx: IssueSink, prefix: PropertyKey[] = []): void {
  const result = schema.safeParse(value);
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({ code: 'custom', message: issue.message, path: [...prefix, ...issue.path] });
  }
}

// ────────────────────────────── Sign in ──────────────────────────────

/** `/auth/login` form and `POST /auth/login` payload. The password is only required here. */
export const loginSchema = z.object({
  email: authEmailSchema,
  password: z.string({ error: vm('auth.passwordRequired') }).min(1, vm('auth.passwordRequired')),
});

export type LoginFormValues = z.input<typeof loginSchema>;

export function createEmptyLoginFormValues(email = ''): LoginFormValues {
  return { email, password: '' };
}

export function toLoginRequest(values: LoginFormValues): LoginRequest {
  return { email: normalizeEmail(values.email), password: values.password };
}

// ────────────────────────────── Password reset ──────────────────────────────

/** `/auth/forgot-password` form and `POST /auth/password-reset` payload. */
export const forgotPasswordSchema = z.object({ email: authEmailSchema });

export type ForgotPasswordFormValues = z.input<typeof forgotPasswordSchema>;

export function toPasswordResetRequest(values: ForgotPasswordFormValues): PasswordResetRequest {
  return { email: normalizeEmail(values.email) };
}

// ────────────────────────────── Google ──────────────────────────────

/** `POST /auth/google` payload. */
export const googleAuthRequestSchema = z.object({
  idToken: z.string({ error: vm('auth.googleSignInRequired') }).trim().min(1, vm('auth.googleSignInRequired')),
});

// ────────────────────────────── Sign up: steps ──────────────────────────────

/** How the new account signs in: email + password, or the Google identity it was started with. */
export const SIGN_UP_AUTH_METHODS = ['password', 'google'] as const;
export type SignUpAuthMethod = (typeof SIGN_UP_AUTH_METHODS)[number];

/** Step 1 – role. */
export const signUpRoleSchema = z.object({
  role: z
    .enum(USER_ROLES, { error: vm('auth.roleRequired') })
    .nullable()
    .superRefine((value, ctx) => {
      if (value === null) ctx.addIssue({ code: 'custom', message: vm('auth.roleRequired') });
    }),
});

/**
 * Step 2 – account. One schema for both variants, selected by `authMethod`:
 * - `password`: password + confirmation are validated (new-password rules, must match);
 * - `google`: the password fields are ignored (the account signs in with Google).
 */
export const signUpAccountSchema = z
  .object({
    authMethod: z.enum(SIGN_UP_AUTH_METHODS, { error: vm('invalid') }),
    firstName: personNameSchema('auth.firstNameRequired'),
    lastName: personNameSchema('auth.lastNameRequired'),
    email: authEmailSchema,
    phone: phoneSchema,
    password: z.string({ error: vm('auth.passwordRequired') }),
    confirmPassword: z.string({ error: vm('auth.confirmPasswordRequired') }),
    acceptedTerms: z.boolean({ error: vm('auth.termsRequired') }).refine((value) => value, { message: vm('auth.termsRequired') }),
  })
  .superRefine(
    (values, ctx) => {
      // Runs even when other fields are invalid, so every problem shows up on the first submit.
      if (values.authMethod !== 'password') return;
      const password = typeof values.password === 'string' ? values.password : '';
      const confirm = typeof values.confirmPassword === 'string' ? values.confirmPassword : '';
      const issue = newPasswordIssue(password);
      if (issue) ctx.addIssue({ code: 'custom', path: ['password'], message: issue });
      if (confirm.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: vm('auth.confirmPasswordRequired') });
      } else if (confirm !== password) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: vm('auth.passwordMismatch') });
      }
    },
    { when: () => true },
  );

/** Step 3 (professionals) – optional business name and 1–10 catalog services. */
export const signUpServicesSchema = z.object({
  businessName: businessNameSchema,
  categoryIds: signUpCategoryIdsSchema,
});

/** Step 4 (professionals) – base address and service radius. */
export const signUpAreaSchema = z.object({
  baseLocation: requestFormLocationSchema.nullable().superRefine((value, ctx) => {
    if (value === null) ctx.addIssue({ code: 'custom', message: vm('auth.baseLocationRequired') });
  }),
  serviceRadiusKm: serviceRadiusSchema,
});

export const SIGN_UP_STEPS = ['role', 'account', 'services', 'area'] as const;
export type SignUpStep = (typeof SIGN_UP_STEPS)[number];

/** Steps of the sign-up flow: customers finish after the account, professionals after the area. */
export function signUpStepsFor(role: UserRole | null): SignUpStep[] {
  return role === 'professional' ? ['role', 'account', 'services', 'area'] : ['role', 'account'];
}

export const SIGN_UP_STEP_SCHEMAS = {
  role: signUpRoleSchema,
  account: signUpAccountSchema,
  services: signUpServicesSchema,
  area: signUpAreaSchema,
} as const satisfies Record<SignUpStep, z.ZodType>;

// ────────────────────────────── Sign up: whole form ──────────────────────────────

/**
 * The whole sign-up form (one react-hook-form instance across the steps). Every step's rules are
 * applied; services and area only for professionals. Validate one step with
 * `trigger(SIGN_UP_STEP_FIELDS[step])`.
 */
export const signUpFormSchema = z
  .object({
    role: z.enum(USER_ROLES).nullable(),
    authMethod: z.enum(SIGN_UP_AUTH_METHODS),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string(),
    password: z.string(),
    confirmPassword: z.string(),
    acceptedTerms: z.boolean(),
    businessName: z.string(),
    categoryIds: z.array(z.string()),
    baseLocation: z.custom<RequestFormLocation | null>(),
    serviceRadiusKm: z.number(),
  })
  .superRefine(
    (values, ctx) => {
      forwardIssues(signUpRoleSchema, values, ctx);
      forwardIssues(signUpAccountSchema, values, ctx);
      if (values.role !== 'professional') return;
      forwardIssues(signUpServicesSchema, values, ctx);
      forwardIssues(signUpAreaSchema, values, ctx);
    },
    { when: () => true },
  );

export type SignUpFormValues = z.input<typeof signUpFormSchema>;
export type SignUpField = keyof SignUpFormValues;

/** Form fields validated by each step (for `trigger(fields)` before moving on). */
export const SIGN_UP_STEP_FIELDS = {
  role: ['role'],
  account: ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword', 'acceptedTerms'],
  services: ['businessName', 'categoryIds'],
  area: ['baseLocation', 'serviceRadiusKm'],
} as const satisfies Record<SignUpStep, readonly SignUpField[]>;

/** The step that shows `field` (e.g. to jump to the first server field error). */
export function signUpStepForField(field: SignUpField): SignUpStep {
  const step = SIGN_UP_STEPS.find((candidate) => (SIGN_UP_STEP_FIELDS[candidate] as readonly SignUpField[]).includes(field));
  return step ?? 'account';
}

interface EmptySignUpOptions {
  role?: UserRole | null;
  /** Identity of a new Google user: prefills the names and the (locked) email. */
  googleProfile?: GoogleProfile | null;
}

export function createEmptySignUpFormValues({ role = null, googleProfile = null }: EmptySignUpOptions = {}): SignUpFormValues {
  return {
    role,
    authMethod: googleProfile ? 'google' : 'password',
    firstName: googleProfile?.firstName ?? '',
    lastName: googleProfile?.lastName ?? '',
    email: googleProfile?.email ?? '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
    businessName: '',
    categoryIds: [],
    baseLocation: null,
    serviceRadiusKm: APP_CONFIG.defaultServiceRadiusKm,
  };
}

/** Switches the form to a Google account: names/email from Google, password fields cleared. */
export function applyGoogleProfile(values: SignUpFormValues, profile: GoogleProfile): SignUpFormValues {
  return {
    ...values,
    authMethod: 'google',
    firstName: profile.firstName || values.firstName,
    lastName: profile.lastName || values.lastName,
    email: profile.email,
    password: '',
    confirmPassword: '',
  };
}

interface RegisterRequestContext {
  preferredLanguage: AppLanguage;
  /** Google id token of the pending Google identity (required when `authMethod === 'google'`). */
  googleIdToken?: string | null;
}

/**
 * Converts sign-up values that passed `signUpFormSchema` into the `POST /auth/register` payload.
 * Throws for values that could not have passed validation (no role, terms not accepted).
 */
export function toRegisterRequest(values: SignUpFormValues, { preferredLanguage, googleIdToken = null }: RegisterRequestContext): RegisterRequest {
  if (!values.role) throw new Error('toRegisterRequest: a role is required');
  if (!values.acceptedTerms) throw new Error('toRegisterRequest: the terms must be accepted');
  const isGoogle = values.authMethod === 'google';
  const location = values.baseLocation;
  const businessName = values.businessName.trim();
  return {
    role: values.role,
    firstName: values.firstName.trim().replace(/\s+/g, ' '),
    lastName: values.lastName.trim().replace(/\s+/g, ' '),
    email: normalizeEmail(values.email),
    phone: normalizePhone(values.phone.trim()),
    password: isGoogle ? null : values.password,
    googleIdToken: isGoogle ? googleIdToken : null,
    acceptedTerms: true,
    preferredLanguage,
    professional:
      values.role === 'professional' && location
        ? {
            businessName: businessName || null,
            categoryIds: values.categoryIds.filter((id): id is CategoryId => isSupportedCategoryId(id)),
            baseLocation: {
              coordinates: { ...location.coordinates },
              addressLine: location.addressLine.trim(),
              city: location.city.trim(),
              neighborhood: location.neighborhood?.trim() || null,
              details: location.details?.trim() || null,
            },
            serviceRadiusKm: values.serviceRadiusKm,
          }
        : null,
  };
}

/** Server field paths of `POST /auth/register` → sign-up form fields. */
const REGISTER_FIELD_TO_FORM: Record<string, SignUpField> = {
  'professional.businessName': 'businessName',
  'professional.categoryIds': 'categoryIds',
  'professional.baseLocation': 'baseLocation',
  'professional.serviceRadiusKm': 'serviceRadiusKm',
  professional: 'categoryIds',
  googleIdToken: 'email',
};

function isSignUpField(value: string): value is SignUpField {
  return value in createEmptySignUpFormValues();
}

/**
 * Maps `fieldErrors` of a failed `POST /auth/register` onto the sign-up form fields (first message
 * per field). Unknown paths are dropped.
 */
export function registerFieldErrorsToForm(fieldErrors: Record<string, string[]> | undefined): Partial<Record<SignUpField, string>> {
  const result: Partial<Record<SignUpField, string>> = {};
  for (const [path, messages] of Object.entries(fieldErrors ?? {})) {
    const message = messages[0];
    if (!message) continue;
    const mapped =
      REGISTER_FIELD_TO_FORM[path] ??
      Object.entries(REGISTER_FIELD_TO_FORM).find(([prefix]) => path.startsWith(`${prefix}.`))?.[1] ??
      path.split('.')[0];
    if (isSignUpField(mapped) && !(mapped in result)) result[mapped] = message;
  }
  return result;
}

// ────────────────────────────── Sign up: REST payload ──────────────────────────────

const professionalSignUpDetailsSchema = z.object({
  businessName: nullableText(PROFILE_LIMITS.businessNameMax, vm('profile.businessNameTooLong')),
  categoryIds: z
    .array(categoryIdSchema, { error: vm('category.minOne') })
    .min(1, vm('category.minOne'))
    .max(PROFILE_LIMITS.maxCategories, vm('category.tooMany'))
    .transform((ids) => [...new Set(ids)]),
  baseLocation: serviceLocationInputSchema,
  serviceRadiusKm: serviceRadiusSchema,
});

/** `POST /auth/register` payload (validated by the server with the same rules as the form). */
export const registerRequestSchema = z
  .object({
    role: z.enum(USER_ROLES, { error: vm('auth.roleRequired') }),
    firstName: personNameSchema('auth.firstNameRequired'),
    lastName: personNameSchema('auth.lastNameRequired'),
    email: authEmailSchema,
    phone: phoneSchema,
    password: z.string({ error: vm('auth.passwordRequired') }).nullable(),
    googleIdToken: z.string({ error: vm('auth.googleSignInRequired') }).trim().nullable(),
    acceptedTerms: z.literal(true, { error: vm('auth.termsRequired') }),
    preferredLanguage: z.enum(SUPPORTED_LANGUAGES, { error: vm('invalid') }),
    professional: professionalSignUpDetailsSchema.nullable(),
  })
  .superRefine(
    (values, ctx) => {
      const password = typeof values.password === 'string' ? values.password : null;
      const googleIdToken = typeof values.googleIdToken === 'string' && values.googleIdToken.trim() ? values.googleIdToken : null;
      if (password !== null && googleIdToken !== null) {
        ctx.addIssue({ code: 'custom', path: ['googleIdToken'], message: vm('invalid') });
      } else if (googleIdToken === null) {
        const issue = newPasswordIssue(password ?? '');
        if (issue) ctx.addIssue({ code: 'custom', path: ['password'], message: issue });
      }
      if (values.role === 'professional' && (values.professional === null || values.professional === undefined)) {
        ctx.addIssue({ code: 'custom', path: ['professional'], message: vm('auth.professionalDetailsRequired') });
      }
      if (values.role === 'customer' && values.professional) {
        ctx.addIssue({ code: 'custom', path: ['professional'], message: vm('invalid') });
      }
    },
    { when: () => true },
  );

export type RegisterRequestInput = z.output<typeof registerRequestSchema>;

/** `POST /auth/password-reset` payload. */
export const passwordResetRequestSchema = forgotPasswordSchema;
