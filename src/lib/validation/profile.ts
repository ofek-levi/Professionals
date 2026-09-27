/**
 * Profile validation: professional and customer edit forms plus the `PATCH /professional/profile`
 * and `PATCH /customer/profile` payloads.
 */
import { z } from 'zod';

import { APP_CONFIG } from '@/constants/app-config';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import { hasAnyWorkingDay } from '@/features/profiles/availability';
import type { UpdateCustomerProfilePayload, UpdateProfessionalProfilePayload } from '@/types/api';
import {
  WEEKDAYS,
  type CategoryId,
  type CurrencyCode,
  type CustomerProfile,
  type ProfessionalProfile,
  type User,
  type Weekday,
} from '@/types/domain';
import { isValidTimeOfDay, timeToMinutes } from '@/utils/dates';

import {
  categoryIdSchema,
  coordinatesSchema,
  currencySchema,
  emailSchema,
  nullableText,
  optionalText,
  parseAmountInput,
  phoneSchema,
  priceSchema,
  requiredText,
  serviceLocationInputSchema,
  isValidWebsite,
  normalizePhone,
  normalizeWebsite,
} from './common';
import { vm } from './messages';
import { requestFormLocationSchema } from './request';

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
} as const;

// ────────────────────────────── Building blocks ──────────────────────────────

export const dayAvailabilitySchema = z
  .object({ enabled: z.boolean(), start: z.string(), end: z.string() })
  .superRefine((day, ctx) => {
    if (!day.enabled) return;
    const startValid = isValidTimeOfDay(day.start);
    const endValid = isValidTimeOfDay(day.end);
    if (!startValid) ctx.addIssue({ code: 'custom', message: vm('profile.timeInvalid'), path: ['start'] });
    if (!endValid) ctx.addIssue({ code: 'custom', message: vm('profile.timeInvalid'), path: ['end'] });
    if (startValid && endValid && timeToMinutes(day.end) <= timeToMinutes(day.start)) {
      ctx.addIssue({ code: 'custom', message: vm('profile.availabilityEndBeforeStart'), path: ['end'] });
    }
  });

const daysShape = Object.fromEntries(WEEKDAYS.map((day) => [day, dayAvailabilitySchema])) as Record<
  Weekday,
  typeof dayAvailabilitySchema
>;

export const weeklyAvailabilitySchema = z
  .object({ days: z.object(daysShape), acceptsEmergencyCalls: z.boolean() })
  .superRefine((availability, ctx) => {
    if (!hasAnyWorkingDay(availability)) {
      ctx.addIssue({ code: 'custom', message: vm('profile.availabilityNoDays'), path: ['days'] });
    }
  });

export const serviceAreaSchema = z.object({
  center: coordinatesSchema,
  radiusKm: z
    .number({ error: vm('invalid') })
    .min(APP_CONFIG.minServiceRadiusKm, vm('profile.radiusTooSmall'))
    .max(APP_CONFIG.maxServiceRadiusKm, vm('profile.radiusTooLarge')),
  label: requiredText({ max: 80, required: vm('profile.serviceAreaRequired'), tooLong: vm('invalid') }),
});

export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  jobUpdates: z.boolean(),
  messages: z.boolean(),
  newRequests: z.boolean(),
  reminders: z.boolean(),
});

const fullNameSchema = requiredText({
  max: PROFILE_LIMITS.nameMax,
  required: vm('profile.fullNameRequired'),
  tooLong: vm('profile.nameTooLong'),
}).refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, { message: vm('profile.fullNameTooShort') });

const displayNameSchema = requiredText({
  max: PROFILE_LIMITS.displayNameMax,
  required: vm('profile.displayNameRequired'),
  tooLong: vm('profile.nameTooLong'),
});

const headlineSchema = requiredText({
  max: PROFILE_LIMITS.headlineMax,
  required: vm('profile.headlineRequired'),
  tooLong: vm('profile.headlineTooLong'),
});

const bioSchema = requiredText({
  min: PROFILE_LIMITS.bioMin,
  max: PROFILE_LIMITS.bioMax,
  required: vm('profile.bioTooShort'),
  tooShort: vm('profile.bioTooShort'),
  tooLong: vm('profile.bioTooLong'),
});

const yearsSchema = z
  .number({ error: vm('profile.yearsInvalid') })
  .int(vm('profile.yearsInvalid'))
  .min(0, vm('profile.yearsInvalid'))
  .max(PROFILE_LIMITS.maxYearsOfExperience, vm('profile.yearsInvalid'));

const languagesSchema = z
  .array(z.string().trim().regex(/^[a-z]{2,3}$/i, vm('invalid')))
  .min(1, vm('profile.languagesRequired'));

/** Letters (Latin/Hebrew) and digits, optionally separated by spaces, dashes or slashes. */
const LICENSE_PATTERN = /^[A-Za-z0-9\u05D0-\u05EA][A-Za-z0-9\u05D0-\u05EA\s\-/]{2,}$/;

const personNameSchema = (required: 'profile.firstNameRequired' | 'profile.lastNameRequired') =>
  requiredText({ max: PROFILE_LIMITS.nameMax, required: vm(required), tooLong: vm('profile.nameTooLong') });

// ────────────────────────────── Professional profile form ──────────────────────────────

export const professionalProfileFormSchema = z.object({
  fullName: fullNameSchema,
  displayName: displayNameSchema,
  headline: headlineSchema,
  bio: bioSchema,
  categoryIds: z
    .array(z.string())
    .min(1, vm('category.minOne'))
    .max(PROFILE_LIMITS.maxCategories, vm('category.tooMany'))
    .refine((ids) => ids.every((id) => isSupportedCategoryId(id)), { message: vm('category.unsupported') }),
  yearsOfExperience: yearsSchema,
  serviceArea: serviceAreaSchema,
  baseLocation: requestFormLocationSchema.nullable(),
  availability: weeklyAvailabilitySchema,
  phone: phoneSchema,
  email: emailSchema,
  /** Empty string = no website. */
  website: z.string().trim().refine((value) => value === '' || isValidWebsite(value), { message: vm('profile.websiteInvalid') }),
  businessName: optionalText(PROFILE_LIMITS.businessNameMax, vm('profile.businessNameTooLong')),
  licenseNumber: z
    .string()
    .trim()
    .refine((value) => value === '' || (value.length <= PROFILE_LIMITS.licenseNumberMax && LICENSE_PATTERN.test(value)), {
      message: vm('profile.licenseNumberInvalid'),
    }),
  isInsured: z.boolean(),
  languages: languagesSchema,
  /** Starting price typed as text; empty string = not shown. */
  startingPrice: z.string().refine(
    (value) => {
      if (value.trim() === '') return true;
      const amount = parseAmountInput(value);
      return amount !== null && amount > 0 && amount <= APP_CONFIG.maxOfferPrice;
    },
    { message: vm('profile.startingPriceInvalid') },
  ),
});

export type ProfessionalProfileFormValues = z.input<typeof professionalProfileFormSchema>;

export function professionalProfileToFormValues(profile: ProfessionalProfile): ProfessionalProfileFormValues {
  return {
    fullName: profile.fullName,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    categoryIds: [...profile.categoryIds],
    yearsOfExperience: profile.yearsOfExperience,
    serviceArea: { center: { ...profile.serviceArea.center }, radiusKm: profile.serviceArea.radiusKm, label: profile.serviceArea.label },
    baseLocation: profile.baseLocation
      ? {
          coordinates: { ...profile.baseLocation.coordinates },
          addressLine: profile.baseLocation.addressLine,
          city: profile.baseLocation.city,
          neighborhood: profile.baseLocation.neighborhood,
          details: profile.baseLocation.details,
        }
      : null,
    availability: {
      acceptsEmergencyCalls: profile.availability.acceptsEmergencyCalls,
      days: Object.fromEntries(WEEKDAYS.map((day) => [day, { ...profile.availability.days[day] }])) as Record<
        Weekday,
        { enabled: boolean; start: string; end: string }
      >,
    },
    phone: profile.contact.phone,
    email: profile.contact.email,
    website: profile.contact.website ?? '',
    businessName: profile.business.businessName ?? '',
    licenseNumber: profile.business.licenseNumber ?? '',
    isInsured: profile.business.isInsured,
    languages: [...profile.business.languages],
    startingPrice: profile.startingPrice ? String(profile.startingPrice.amount) : '',
  };
}

/** Converts validated form values into the `PATCH /professional/profile` payload. */
export function toUpdateProfessionalProfilePayload(
  values: ProfessionalProfileFormValues,
  currency: CurrencyCode = APP_CONFIG.defaultCurrency,
): UpdateProfessionalProfilePayload {
  const startingAmount = values.startingPrice.trim() ? parseAmountInput(values.startingPrice) : null;
  const website = values.website.trim();
  const businessName = values.businessName.trim();
  const licenseNumber = values.licenseNumber.trim();
  return {
    fullName: values.fullName.trim(),
    displayName: values.displayName.trim(),
    headline: values.headline.trim(),
    bio: values.bio.trim(),
    categoryIds: values.categoryIds.filter((id): id is CategoryId => isSupportedCategoryId(id)),
    yearsOfExperience: values.yearsOfExperience,
    serviceArea: {
      center: { ...values.serviceArea.center },
      radiusKm: values.serviceArea.radiusKm,
      label: values.serviceArea.label.trim(),
    },
    baseLocation: values.baseLocation
      ? {
          coordinates: { ...values.baseLocation.coordinates },
          addressLine: values.baseLocation.addressLine.trim(),
          city: values.baseLocation.city.trim(),
          neighborhood: values.baseLocation.neighborhood?.trim() || null,
          details: values.baseLocation.details?.trim() || null,
          isApproximate: false,
        }
      : null,
    availability: {
      acceptsEmergencyCalls: values.availability.acceptsEmergencyCalls,
      days: Object.fromEntries(WEEKDAYS.map((day) => [day, { ...values.availability.days[day] }])) as Record<
        Weekday,
        { enabled: boolean; start: string; end: string }
      >,
    },
    contact: {
      phone: normalizePhone(values.phone),
      email: values.email.trim().toLowerCase(),
      website: website ? normalizeWebsite(website) : null,
    },
    business: {
      businessName: businessName || null,
      licenseNumber: licenseNumber || null,
      isInsured: values.isInsured,
      languages: values.languages.map((language) => language.toLowerCase()),
    },
    startingPrice: startingAmount !== null ? { amount: startingAmount, currency } : null,
  };
}

/** `PATCH /professional/profile` payload (every field optional). */
export const updateProfessionalProfileSchema = z
  .object({
    fullName: fullNameSchema,
    displayName: displayNameSchema,
    avatarUrl: z.string().trim().min(1, vm('invalid')).nullable(),
    headline: headlineSchema,
    bio: bioSchema,
    categoryIds: z
      .array(categoryIdSchema)
      .min(1, vm('category.minOne'))
      .max(PROFILE_LIMITS.maxCategories, vm('category.tooMany')),
    yearsOfExperience: yearsSchema,
    serviceArea: serviceAreaSchema,
    baseLocation: serviceLocationInputSchema.nullable(),
    availability: weeklyAvailabilitySchema,
    contact: z.object({
      phone: phoneSchema,
      email: emailSchema,
      website: z
        .string()
        .trim()
        .refine((value) => isValidWebsite(value), { message: vm('profile.websiteInvalid') })
        .nullable(),
    }),
    business: z.object({
      businessName: nullableText(PROFILE_LIMITS.businessNameMax, vm('profile.businessNameTooLong')),
      licenseNumber: nullableText(PROFILE_LIMITS.licenseNumberMax, vm('profile.licenseNumberInvalid')),
      isInsured: z.boolean(),
      languages: languagesSchema,
    }),
    startingPrice: z.object({ amount: priceSchema, currency: currencySchema }).nullable(),
    notificationPreferences: notificationPreferencesSchema,
  })
  .partial();

// ────────────────────────────── Customer profile ──────────────────────────────

export const customerProfileFormSchema = z.object({
  firstName: personNameSchema('profile.firstNameRequired'),
  lastName: personNameSchema('profile.lastNameRequired'),
  phone: phoneSchema,
  defaultLocation: requestFormLocationSchema.nullable(),
});

export type CustomerProfileFormValues = z.input<typeof customerProfileFormSchema>;

export function customerProfileToFormValues(
  user: Pick<User, 'firstName' | 'lastName' | 'phone'>,
  profile: Pick<CustomerProfile, 'defaultLocation'>,
): CustomerProfileFormValues {
  const location = profile.defaultLocation;
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    defaultLocation: location
      ? {
          coordinates: { ...location.coordinates },
          addressLine: location.addressLine,
          city: location.city,
          neighborhood: location.neighborhood,
          details: location.details,
        }
      : null,
  };
}

export function toUpdateCustomerProfilePayload(values: CustomerProfileFormValues): UpdateCustomerProfilePayload {
  const location = values.defaultLocation;
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: normalizePhone(values.phone),
    defaultLocation: location
      ? {
          coordinates: { ...location.coordinates },
          addressLine: location.addressLine.trim(),
          city: location.city.trim(),
          neighborhood: location.neighborhood?.trim() || null,
          details: location.details?.trim() || null,
          isApproximate: false,
        }
      : null,
  };
}

/** `PATCH /customer/profile` payload (every field optional). */
export const updateCustomerProfileSchema = z
  .object({
    firstName: personNameSchema('profile.firstNameRequired'),
    lastName: personNameSchema('profile.lastNameRequired'),
    phone: phoneSchema,
    avatarUrl: z.string().trim().min(1, vm('invalid')).nullable(),
    defaultLocation: serviceLocationInputSchema.nullable(),
    notificationPreferences: notificationPreferencesSchema,
  })
  .partial();
