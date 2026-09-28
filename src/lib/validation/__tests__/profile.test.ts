import { createDefaultAvailability } from '@/features/profiles/availability';
import type { ProfessionalProfile } from '@/types/domain';

import { isValidWebsite, phoneSchema } from '../common';
import { zodIssuesToFieldErrors } from '../field-errors';
import {
  customerProfileFormSchema,
  customerProfileToFormValues,
  professionalProfileFormSchema,
  professionalProfileToFormValues,
  toUpdateCustomerProfilePayload,
  toUpdateProfessionalProfilePayload,
  updateCustomerProfileSchema,
  updateProfessionalProfileSchema,
  type ProfessionalProfileFormValues,
} from '../profile';

const profile: ProfessionalProfile = {
  id: 'pro_1',
  userId: 'pro_1',
  fullName: 'Avi Mizrahi',
  displayName: 'AquaFix Plumbing',
  avatarUrl: null,
  headline: 'Licensed plumber',
  bio: 'I have been fixing leaks and clogs across Tel Aviv for many years.',
  categoryIds: ['plumbing'],
  yearsOfExperience: 14,
  serviceArea: { center: { latitude: 32.07, longitude: 34.78 }, radiusKm: 20, label: 'Tel Aviv-Yafo' },
  baseLocation: null,
  availability: createDefaultAvailability(),
  contact: { phone: '050-712-3456', email: 'avi@example.com', website: null },
  business: { businessName: 'AquaFix Plumbing', licenseNumber: '44821', isInsured: true, languages: ['he', 'en'] },
  stats: { averageRating: 4.8, reviewCount: 10, completedJobsCount: 12, responseTimeMinutes: 30 },
  startingPrice: { amount: 250, currency: 'ILS' },
  isVerified: true,
  memberSince: '2023-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const errorsOf = (values: ProfessionalProfileFormValues) => {
  const result = professionalProfileFormSchema.safeParse(values);
  return result.success ? {} : zodIssuesToFieldErrors(result.error);
};

describe('contact helpers', () => {
  it('accepts Israeli and international phone numbers', () => {
    for (const phone of ['050-712-3456', '0507123456', '+972-50-712-3456', '03-5123456', '+1 (415) 555-0100']) {
      expect(phoneSchema.safeParse(phone).success).toBe(true);
    }
    for (const phone of ['12345', '050-12', 'abc', '+0123456789']) expect(phoneSchema.safeParse(phone).success).toBe(false);
  });

  it('accepts websites with or without scheme', () => {
    expect(isValidWebsite('example.com')).toBe(true);
    expect(isValidWebsite('https://www.example.co.il/about')).toBe(true);
    expect(isValidWebsite('not a site')).toBe(false);
  });
});

describe('professional profile form', () => {
  it('round-trips a profile into a valid payload', () => {
    const values = professionalProfileToFormValues(profile);
    expect(errorsOf(values)).toEqual({});
    const payload = toUpdateProfessionalProfilePayload({ ...values, website: 'aquafix.example.com', phone: '050 712 3456' });
    expect(payload.contact).toEqual({ phone: '0507123456', email: 'avi@example.com', website: 'https://aquafix.example.com' });
    expect(payload.startingPrice).toEqual({ amount: 250, currency: 'ILS' });
    expect(updateProfessionalProfileSchema.safeParse(payload).success).toBe(true);
  });

  it('reports every invalid field', () => {
    const values = professionalProfileToFormValues(profile);
    const availability = createDefaultAvailability();
    availability.days.mon = { enabled: true, start: '18:00', end: '09:00' };
    expect(
      errorsOf({
        ...values,
        fullName: 'Avi',
        headline: '',
        bio: 'Too short',
        categoryIds: [],
        yearsOfExperience: 61,
        serviceArea: { ...values.serviceArea, radiusKm: 1 },
        availability,
        phone: '123',
        email: 'nope',
        website: 'nope nope',
        languages: [],
        startingPrice: 'abc',
      }),
    ).toEqual({
      fullName: ['validation:profile.fullNameTooShort'],
      headline: ['validation:profile.headlineRequired'],
      bio: ['validation:profile.bioTooShort'],
      categoryIds: ['validation:category.minOne'],
      yearsOfExperience: ['validation:profile.yearsInvalid'],
      'serviceArea.radiusKm': ['validation:profile.radiusTooSmall'],
      'availability.days.mon.end': ['validation:profile.availabilityEndBeforeStart'],
      phone: ['validation:profile.phoneInvalid'],
      email: ['validation:profile.emailInvalid'],
      website: ['validation:profile.websiteInvalid'],
      languages: ['validation:profile.languagesRequired'],
      startingPrice: ['validation:profile.startingPriceInvalid'],
    });
  });

  it('requires at least one working day and supported categories', () => {
    const values = professionalProfileToFormValues(profile);
    const availability = createDefaultAvailability();
    Object.values(availability.days).forEach((day) => {
      day.enabled = false;
    });
    expect(errorsOf({ ...values, availability, categoryIds: ['plumbing', 'wizardry'] })).toEqual({
      'availability.days': ['validation:profile.availabilityNoDays'],
      categoryIds: ['validation:category.unsupported'],
    });
  });
});

describe('customer profile form', () => {
  it('validates and converts', () => {
    const values = customerProfileToFormValues({ firstName: 'Noa', lastName: 'Levi', phone: '052-555-1234' }, { defaultLocation: null });
    expect(customerProfileFormSchema.safeParse(values).success).toBe(true);
    const payload = toUpdateCustomerProfilePayload(values);
    expect(payload).toEqual({ firstName: 'Noa', lastName: 'Levi', phone: '0525551234', defaultLocation: null });
    expect(updateCustomerProfileSchema.safeParse(payload).success).toBe(true);
    const invalid = customerProfileFormSchema.safeParse({ ...values, firstName: ' ', phone: '1' });
    expect(!invalid.success && zodIssuesToFieldErrors(invalid.error)).toEqual({
      firstName: ['validation:profile.firstNameRequired'],
      phone: ['validation:profile.phoneInvalid'],
    });
  });
});
