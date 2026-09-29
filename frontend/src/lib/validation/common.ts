/**
 * Reusable zod building blocks. All messages are `validation:*` i18n keys (see messages.ts).
 */
import { z } from 'zod';

import { APP_CONFIG } from '@/constants/app-config';
import { CATEGORY_IDS } from '@/constants/professional-categories';
import { SUPPORTED_CURRENCIES } from '@/types/domain';
import { isValidDateKey, isValidDateTimeString } from '@/utils/dates';
import { isValidCoordinates } from '@/utils/geo';

import { vm, type ValidationMessageKey } from './messages';

interface TextRuleOptions {
  /** Minimum length after trimming (default 1). */
  min?: number;
  max: number;
  required?: ValidationMessageKey;
  tooShort?: ValidationMessageKey;
  tooLong: ValidationMessageKey;
}

/** Required text: trimmed, non-empty, within `[min, max]`. */
export function requiredText({ min = 1, max, required = vm('required'), tooShort, tooLong }: TextRuleOptions) {
  return z
    .string({ error: required })
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) ctx.addIssue({ code: 'custom', message: required });
      else if (value.length < min) ctx.addIssue({ code: 'custom', message: tooShort ?? required });
      else if (value.length > max) ctx.addIssue({ code: 'custom', message: tooLong });
    });
}

/** Optional form text (empty string allowed), trimmed, at most `max` characters. */
export function optionalText(max: number, tooLong: ValidationMessageKey) {
  return z.string().trim().max(max, tooLong);
}

/** Optional payload text: `null`, or a trimmed string (an empty string becomes `null`). */
export function nullableText(max: number, tooLong: ValidationMessageKey) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .nullable()
    .transform((value) => (value ? value : null));
}

export const coordinatesSchema = z
  .object({
    latitude: z.number({ error: vm('location.coordinatesInvalid') }),
    longitude: z.number({ error: vm('location.coordinatesInvalid') }),
  })
  .refine((value) => isValidCoordinates(value), { message: vm('location.coordinatesInvalid') });

export const LOCATION_LIMITS = { addressLineMax: 120, cityMax: 60, neighborhoodMax: 60, detailsMax: 200 } as const;

/** A concrete service location (without the server-controlled `isApproximate` flag). */
export const serviceLocationInputSchema = z.object({
  coordinates: coordinatesSchema,
  addressLine: requiredText({
    max: LOCATION_LIMITS.addressLineMax,
    required: vm('location.addressRequired'),
    tooLong: vm('location.addressTooLong'),
  }),
  city: requiredText({ max: LOCATION_LIMITS.cityMax, required: vm('location.cityRequired'), tooLong: vm('invalid') }),
  neighborhood: nullableText(LOCATION_LIMITS.neighborhoodMax, vm('invalid')),
  details: nullableText(LOCATION_LIMITS.detailsMax, vm('location.detailsTooLong')),
});

export const dateKeySchema = (message: ValidationMessageKey = vm('invalid')) =>
  z.string({ error: message }).refine((value) => isValidDateKey(value), { message });

export const isoDateTimeSchema = (message: ValidationMessageKey = vm('invalid')) =>
  z.string({ error: message }).refine((value) => isValidDateTimeString(value), { message });

export const currencySchema = z.enum(SUPPORTED_CURRENCIES, { error: vm('offer.currencyUnsupported') });

/** Only ids from the category catalog are accepted. */
export const categoryIdSchema = z.enum(CATEGORY_IDS, {
  error: (issue) => (issue.input === undefined || issue.input === null || issue.input === '' ? vm('category.required') : vm('category.unsupported')),
});

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

/**
 * Parses a user-typed amount ("1,250", "1250.5", " 300 ") into a number, or `null` when it is not
 * a plain non-negative decimal number.
 */
export function parseAmountInput(input: string): number | null {
  const cleaned = input.replace(/[\s, ₪$€]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Price issue for a numeric amount, or `null` when valid. */
export function priceIssue(value: number): ValidationMessageKey | null {
  if (!Number.isFinite(value) || value <= 0) return vm('offer.priceInvalid');
  if (value < APP_CONFIG.minOfferPrice) return vm('offer.priceTooLow');
  if (value > APP_CONFIG.maxOfferPrice) return vm('offer.priceTooHigh');
  if (!hasAtMostTwoDecimals(value)) return vm('offer.priceDecimals');
  return null;
}

/** Price in major currency units within the APP_CONFIG bounds, max 2 decimals. */
export const priceSchema = z.number({ error: vm('offer.priceInvalid') }).superRefine((value, ctx) => {
  const issue = priceIssue(value);
  if (issue) ctx.addIssue({ code: 'custom', message: issue });
});

/** Removes formatting characters from a phone number: spaces, dashes, dots and parentheses. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '');
}

const ISRAELI_PHONE = /^(?:\+972|0)(?:5\d|7\d|[2-4]|[89])\d{7}$/;
const INTERNATIONAL_PHONE = /^\+[1-9]\d{7,14}$/;

/** Israeli mobile/landline (05X…, 0X…, +972…) or an international number in E.164 form. */
function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  return ISRAELI_PHONE.test(normalized) || INTERNATIONAL_PHONE.test(normalized);
}

/** Loose email format check (`name@domain.tld`); the server is the source of truth. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Website with or without scheme: `example.com`, `https://www.example.co.il/about`. */
export function isValidWebsite(value: string): boolean {
  return /^(https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(:\d{2,5})?(\/\S*)?$/i.test(value.trim());
}

/** Adds `https://` to a website entered without a scheme. */
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const phoneSchema = z
  .string({ error: vm('profile.phoneRequired') })
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) ctx.addIssue({ code: 'custom', message: vm('profile.phoneRequired') });
    else if (!isValidPhone(value)) ctx.addIssue({ code: 'custom', message: vm('profile.phoneInvalid') });
  });

export const emailSchema = z
  .string({ error: vm('profile.emailRequired') })
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) ctx.addIssue({ code: 'custom', message: vm('profile.emailRequired') });
    else if (!isValidEmail(value)) ctx.addIssue({ code: 'custom', message: vm('profile.emailInvalid') });
  });
