/** Business blocks of the professional profile PATCH: availability, contact, languages, price. */
import { z } from 'zod';

import { APP_CONFIG } from '../../shared/limits.js';
import { SUPPORTED_CURRENCIES, WEEKDAYS, type Weekday } from '../../shared/domain.js';
import { vm, type ValidationMessage } from '../../shared/validation-messages.js';
import { phoneSchema } from '../auth/auth-fields.schemas.js';
import { PROFILE_LIMITS } from './profile-fields.schemas.js';

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(:\d{2,5})?(\/\S*)?$/i;

function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** Times are only checked on working days (a day off keeps whatever the form had). */
const dayAvailabilitySchema = z
  .object({ enabled: z.boolean(), start: z.string().max(5, vm('profile.timeInvalid')), end: z.string().max(5, vm('profile.timeInvalid')) })
  .superRefine((day, ctx) => {
    if (!day.enabled) return;
    const startValid = TIME_OF_DAY.test(day.start);
    const endValid = TIME_OF_DAY.test(day.end);
    if (!startValid) ctx.addIssue({ code: 'custom', message: vm('profile.timeInvalid'), path: ['start'] });
    if (!endValid) ctx.addIssue({ code: 'custom', message: vm('profile.timeInvalid'), path: ['end'] });
    if (startValid && endValid && minutesOf(day.end) <= minutesOf(day.start)) {
      ctx.addIssue({ code: 'custom', message: vm('profile.availabilityEndBeforeStart'), path: ['end'] });
    }
  });

const daysShape = Object.fromEntries(WEEKDAYS.map((day) => [day, dayAvailabilitySchema])) as Record<Weekday, typeof dayAvailabilitySchema>;

export const availabilitySchema = z
  .object({ days: z.object(daysShape), acceptsEmergencyCalls: z.boolean() })
  .superRefine((availability, ctx) => {
    if (!WEEKDAYS.some((day) => availability.days[day].enabled)) {
      ctx.addIssue({ code: 'custom', message: vm('profile.availabilityNoDays'), path: ['days'] });
    }
  });

const contactEmailSchema = z
  .string({ error: vm('profile.emailRequired') })
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) ctx.addIssue({ code: 'custom', message: vm('profile.emailRequired') });
    else if (value.length > 254 || !EMAIL_PATTERN.test(value)) ctx.addIssue({ code: 'custom', message: vm('profile.emailInvalid') });
  })
  .transform((value) => value.toLowerCase());

/** `example.com` is stored as `https://example.com`. */
const websiteSchema = z
  .string()
  .trim()
  .refine((value) => value.length <= PROFILE_LIMITS.urlMax && WEBSITE_PATTERN.test(value), { message: vm('profile.websiteInvalid') })
  .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
  .nullable();

/** Public contact details; the phone also becomes the account phone. */
export const contactSchema = z.object({ phone: phoneSchema, email: contactEmailSchema, website: websiteSchema });

export const languagesSchema = z
  .array(z.string().trim().regex(/^[a-z]{2,3}$/i, vm('invalid')))
  .min(1, vm('profile.languagesRequired'))
  .max(PROFILE_LIMITS.maxLanguages, vm('invalid'))
  .transform((codes) => [...new Set(codes.map((code) => code.toLowerCase()))]);

function priceIssue(value: number): ValidationMessage | null {
  if (!Number.isFinite(value) || value <= 0) return vm('offer.priceInvalid');
  if (value < APP_CONFIG.minOfferPrice) return vm('offer.priceTooLow');
  if (value > APP_CONFIG.maxOfferPrice) return vm('offer.priceTooHigh');
  if (Math.abs(Math.round(value * 100) - value * 100) >= 1e-6) return vm('offer.priceDecimals');
  return null;
}

/** Same rules as offer prices (the app's `priceSchema`). */
const priceSchema = z.number({ error: vm('offer.priceInvalid') }).superRefine((value, ctx) => {
  const issue = priceIssue(value);
  if (issue) ctx.addIssue({ code: 'custom', message: issue });
});

export const startingPriceSchema = z
  .object({ amount: priceSchema, currency: z.enum(SUPPORTED_CURRENCIES, { error: vm('offer.currencyUnsupported') }) })
  .nullable();
