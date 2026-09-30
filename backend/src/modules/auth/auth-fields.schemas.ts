/**
 * zod building blocks of the account payloads, ported from the app (`frontend/src/lib/validation/
 * auth.ts` + `common.ts`) with the same rules and `validation:*` messages, so a form the app
 * accepts is accepted here and server field errors land on the same form fields.
 */
import { z } from 'zod';

import { CATEGORY_IDS } from '../../shared/catalog/index.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { vm, type ValidationMessage } from '../../shared/validation-messages.js';
import { NAME_LETTER } from './password-rules.js';

/** RFC 5321 limit of an email address. */
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Starts with a letter; then letters, spaces, hyphens and apostrophes (', ’, Hebrew geresh ׳). */
const NAME_PATTERN = new RegExp(`^[${NAME_LETTER}][${NAME_LETTER}\\s'’\\u05F3\\-]*$`);
const ISRAELI_PHONE = /^(?:\+972|0)(?:5\d|7\d|[2-4]|[89])\d{7}$/;
const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/;

const LOCATION_LIMITS = { addressLineMax: 120, cityMax: 60, neighborhoodMax: 60, detailsMax: 200 } as const;
export const SIGN_UP_LIMITS = { businessNameMax: 80, maxCategories: 10 } as const;

/** Canonical form of an email address: accounts are case-insensitive. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Required, valid email; the parsed value is trimmed and lower-cased. */
export const authEmailSchema = z
  .string({ error: vm('auth.emailRequired') })
  .superRefine((value, ctx) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) ctx.addIssue({ code: 'custom', message: vm('auth.emailRequired') });
    else if (trimmed.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(trimmed)) {
      ctx.addIssue({ code: 'custom', message: vm('auth.emailInvalid') });
    }
  })
  .transform(normalizeEmail);

function personNameIssue(value: string, required: ValidationMessage): ValidationMessage | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return required;
  if (trimmed.length < APP_CONFIG.personNameMinLength) return vm('auth.nameTooShort');
  if (trimmed.length > APP_CONFIG.personNameMaxLength) return vm('auth.nameTooLong');
  if (!NAME_PATTERN.test(trimmed)) return vm('auth.nameInvalid');
  return null;
}

/** First/last name: trimmed, inner whitespace collapsed. */
export const personNameSchema = (required: 'auth.firstNameRequired' | 'auth.lastNameRequired') =>
  z
    .string({ error: vm(required) })
    .superRefine((value, ctx) => {
      const issue = personNameIssue(value, vm(required));
      if (issue) ctx.addIssue({ code: 'custom', message: issue });
    })
    .transform((value) => value.trim().replace(/\s+/g, ' '));

/** Israeli mobile/landline (05X…, 0X…, +972…) or an international number in E.164 form. */
export const phoneSchema = z
  .string({ error: vm('profile.phoneRequired') })
  .trim()
  .superRefine((value, ctx) => {
    const normalized = value.replace(/[\s\-().]/g, '');
    if (value.length === 0) ctx.addIssue({ code: 'custom', message: vm('profile.phoneRequired') });
    else if (!ISRAELI_PHONE.test(normalized) && !INTERNATIONAL_PHONE.test(normalized)) {
      ctx.addIssue({ code: 'custom', message: vm('profile.phoneInvalid') });
    }
  });

function requiredText(max: number, required: ValidationMessage, tooLong: ValidationMessage) {
  return z
    .string({ error: required })
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) ctx.addIssue({ code: 'custom', message: required });
      else if (value.length > max) ctx.addIssue({ code: 'custom', message: tooLong });
    });
}

/** `null`, or trimmed text (an empty string becomes `null`). */
export function nullableText(max: number, tooLong: ValidationMessage) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .nullable()
    .transform((value) => (value ? value : null));
}

const coordinatesSchema = z
  .object({
    latitude: z.number({ error: vm('location.coordinatesInvalid') }),
    longitude: z.number({ error: vm('location.coordinatesInvalid') }),
  })
  .refine((value) => Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180, { message: vm('location.coordinatesInvalid') });

/** A concrete service location (the server controls `isApproximate`). */
export const serviceLocationInputSchema = z.object({
  coordinates: coordinatesSchema,
  addressLine: requiredText(LOCATION_LIMITS.addressLineMax, vm('location.addressRequired'), vm('location.addressTooLong')),
  city: requiredText(LOCATION_LIMITS.cityMax, vm('location.cityRequired'), vm('invalid')),
  neighborhood: nullableText(LOCATION_LIMITS.neighborhoodMax, vm('invalid')),
  details: nullableText(LOCATION_LIMITS.detailsMax, vm('location.detailsTooLong')),
});

/** Catalog ids only (an unknown id makes the request a 422 `UNSUPPORTED_CATEGORY`). */
export const categoryIdSchema = z.enum(CATEGORY_IDS, {
  error: (issue) =>
    issue.input === undefined || issue.input === null || issue.input === '' ? vm('category.required') : vm('category.unsupported'),
});

/** 1–10 catalog categories, de-duplicated. */
export const signUpCategoryIdsSchema = z
  .array(categoryIdSchema, { error: vm('category.minOne') })
  .min(1, vm('category.minOne'))
  .max(SIGN_UP_LIMITS.maxCategories, vm('category.tooMany'))
  .transform((ids) => [...new Set(ids)]);

export const serviceRadiusSchema = z
  .number({ error: vm('invalid') })
  .min(APP_CONFIG.minServiceRadiusKm, vm('profile.radiusTooSmall'))
  .max(APP_CONFIG.maxServiceRadiusKm, vm('profile.radiusTooLarge'));
