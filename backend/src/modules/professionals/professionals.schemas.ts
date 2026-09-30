/** zod schemas of the professional routes (rules of the app's `lib/validation/profile.ts`). */
import { z } from 'zod';

import { paginationQueryShape } from '../../lib/pagination.js';
import { queryEnum, queryNumber } from '../../lib/query-schemas.js';
import { CATEGORY_IDS } from '../../shared/catalog/index.js';
import { vm } from '../../shared/validation-messages.js';
import { categoryIdSchema, nullableText, serviceLocationInputSchema, serviceRadiusSchema } from '../auth/auth-fields.schemas.js';
import { availabilitySchema, contactSchema, languagesSchema, startingPriceSchema } from './profile-business.schemas.js';
import { PROFILE_LIMITS, notificationPreferencesSchema, profileText } from './profile-fields.schemas.js';

export const professionalParams = z.object({ professionalId: z.string() });

export const professionalReviewsQuery = z.object(paginationQueryShape);

/** `?categoryId=&lat=&lng=` (a point only counts when both coordinates are given). */
export const searchProfessionalsQuery = z
  .object({ ...paginationQueryShape, categoryId: queryEnum(CATEGORY_IDS), lat: queryNumber(), lng: queryNumber() })
  .transform(({ lat, lng, ...query }, ctx) => {
    if (lat === undefined || lng === undefined) return { ...query, near: null };
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      ctx.addIssue({ code: 'custom', message: vm('location.coordinatesInvalid'), path: ['lat'] });
      return z.NEVER;
    }
    return { ...query, near: { latitude: lat, longitude: lng } };
  });

const fullNameSchema = profileText({ max: PROFILE_LIMITS.nameMax, required: vm('profile.fullNameRequired'), tooLong: vm('profile.nameTooLong') })
  .refine((value) => value.length === 0 || value.split(/\s+/).length >= 2, { message: vm('profile.fullNameTooShort') });

/** Letters (Latin/Hebrew) and digits, optionally separated by spaces, dashes or slashes. */
const LICENSE_PATTERN = /^[A-Za-z0-9א-ת][A-Za-z0-9א-ת\s\-/]{2,}$/;

/** `PATCH /professional/profile` (every field optional). The avatar is `PUT /me/avatar`. */
export const updateProfessionalProfileBody = z
  .object({
    fullName: fullNameSchema,
    displayName: profileText({ max: PROFILE_LIMITS.displayNameMax, required: vm('profile.displayNameRequired'), tooLong: vm('profile.nameTooLong') }),
    // Sign-up does not ask for a headline or a bio: both may stay empty (the public profile hides them).
    headline: profileText({ max: PROFILE_LIMITS.headlineMax, required: vm('profile.headlineRequired'), tooLong: vm('profile.headlineTooLong'), optional: true }),
    bio: profileText({
      optional: true,
      min: PROFILE_LIMITS.bioMin,
      max: PROFILE_LIMITS.bioMax,
      required: vm('profile.bioTooShort'),
      tooLong: vm('profile.bioTooLong'),
    }),
    categoryIds: z
      .array(categoryIdSchema)
      .min(1, vm('category.minOne'))
      .max(PROFILE_LIMITS.maxCategories, vm('category.tooMany'))
      .transform((ids) => [...new Set(ids)]),
    yearsOfExperience: z
      .number({ error: vm('profile.yearsInvalid') })
      .int(vm('profile.yearsInvalid'))
      .min(0, vm('profile.yearsInvalid'))
      .max(PROFILE_LIMITS.maxYearsOfExperience, vm('profile.yearsInvalid')),
    serviceArea: z.object({
      center: serviceLocationInputSchema.shape.coordinates,
      radiusKm: serviceRadiusSchema,
      label: profileText({ max: 80, required: vm('profile.serviceAreaRequired'), tooLong: vm('invalid') }),
    }),
    baseLocation: serviceLocationInputSchema.nullable(),
    availability: availabilitySchema,
    contact: contactSchema,
    business: z.object({
      businessName: nullableText(PROFILE_LIMITS.businessNameMax, vm('profile.businessNameTooLong')),
      licenseNumber: nullableText(PROFILE_LIMITS.licenseNumberMax, vm('profile.licenseNumberInvalid')).refine(
        (value) => value === null || LICENSE_PATTERN.test(value),
        { message: vm('profile.licenseNumberInvalid') },
      ),
      isInsured: z.boolean(),
      languages: languagesSchema,
    }),
    startingPrice: startingPriceSchema,
    notificationPreferences: notificationPreferencesSchema,
  })
  .partial();

export type UpdateProfessionalProfileInput = z.output<typeof updateProfessionalProfileBody>;
export type SearchProfessionalsInput = z.output<typeof searchProfessionalsQuery>;
