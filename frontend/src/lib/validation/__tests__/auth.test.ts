import { APP_CONFIG } from '@/constants/app-config';
import type { GoogleProfile } from '@/types/api';

import {
  applyGoogleProfile,
  createEmptySignUpFormValues,
  forgotPasswordSchema,
  loginSchema,
  newPasswordIssue,
  registerFieldErrorsToForm,
  registerRequestSchema,
  signUpAccountSchema,
  signUpAreaSchema,
  signUpFormSchema,
  signUpRoleSchema,
  signUpServicesSchema,
  signUpStepForField,
  signUpStepsFor,
  simulatedGoogleAccountSchema,
  toLoginRequest,
  toPasswordResetRequest,
  toRegisterRequest,
  type SignUpFormValues,
} from '../auth';
import { zodIssuesToFieldErrors } from '../field-errors';

const errorsOf = (schema: { safeParse: (value: unknown) => { success: boolean; error?: unknown } }, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? {} : zodIssuesToFieldErrors(result.error as Parameters<typeof zodIssuesToFieldErrors>[0]);
};

const location = {
  coordinates: { latitude: 32.0853, longitude: 34.7818 },
  addressLine: 'Dizengoff St 120',
  city: 'Tel Aviv-Yafo',
  neighborhood: null,
  details: null,
};

const validAccount = {
  authMethod: 'password' as const,
  firstName: 'Noa',
  lastName: 'Levi',
  email: 'noa@example.com',
  phone: '050-123-4567',
  password: 'Secret123',
  confirmPassword: 'Secret123',
  acceptedTerms: true,
};

function signUpValues(overrides: Partial<SignUpFormValues> = {}): SignUpFormValues {
  return { ...createEmptySignUpFormValues({ role: 'customer' }), ...validAccount, ...overrides };
}

describe('email', () => {
  it('accepts valid addresses, trims and lower-cases them', () => {
    const parsed = loginSchema.parse({ email: '  Noa.Levi@Example.COM ', password: 'x' });
    expect(parsed.email).toBe('noa.levi@example.com');
    for (const email of ['a@b.co', 'first.last+tag@sub.example.org', 'user@mail.co.il']) {
      expect(forgotPasswordSchema.safeParse({ email }).success).toBe(true);
    }
  });

  it('rejects missing and malformed addresses with auth messages', () => {
    expect(errorsOf(forgotPasswordSchema, { email: '' })).toEqual({ email: ['validation:auth.emailRequired'] });
    expect(errorsOf(forgotPasswordSchema, { email: '   ' })).toEqual({ email: ['validation:auth.emailRequired'] });
    for (const email of ['noa', 'noa@', '@example.com', 'noa@example', 'noa @example.com', 'noa@example.c', `${'a'.repeat(250)}@x.com`]) {
      expect(errorsOf(forgotPasswordSchema, { email })).toEqual({ email: ['validation:auth.emailInvalid'] });
    }
    expect(errorsOf(forgotPasswordSchema, {})).toEqual({ email: ['validation:auth.emailRequired'] });
  });

  it('builds normalized login and reset payloads', () => {
    expect(toLoginRequest({ email: ' Noa@Example.com', password: ' pass ' })).toEqual({ email: 'noa@example.com', password: ' pass ' });
    expect(toPasswordResetRequest({ email: 'NOA@example.com ' })).toEqual({ email: 'noa@example.com' });
  });
});

describe('login', () => {
  it('only requires a password (no strength rules)', () => {
    expect(loginSchema.safeParse({ email: 'noa@example.com', password: 'a' }).success).toBe(true);
    expect(errorsOf(loginSchema, { email: 'noa@example.com', password: '' })).toEqual({ password: ['validation:auth.passwordRequired'] });
  });
});

describe('new password rules', () => {
  it('rejects the most common passwords and the published demo password', () => {
    expect(newPasswordIssue('Demo1234')).toBe('validation:auth.passwordTooCommon');
    expect(newPasswordIssue('PASSWORD1')).toBe('validation:auth.passwordTooCommon');
    expect(newPasswordIssue('12345678a')).toBe('validation:auth.passwordTooCommon');
    expect(newPasswordIssue('Tomato-Lamp7')).toBeNull();
  });

  it('requires 8–64 characters with a letter and a number', () => {
    expect(newPasswordIssue('Secret123')).toBeNull();
    expect(newPasswordIssue('סיסמה1234')).toBeNull();
    expect(newPasswordIssue('')).toBe('validation:auth.passwordRequired');
    expect(newPasswordIssue('Abc123')).toBe('validation:auth.passwordTooShort');
    expect(newPasswordIssue(`a1${'x'.repeat(APP_CONFIG.passwordMaxLength)}`)).toBe('validation:auth.passwordTooLong');
    expect(newPasswordIssue('abcdefgh')).toBe('validation:auth.passwordLetterAndNumber');
    expect(newPasswordIssue('12345678')).toBe('validation:auth.passwordLetterAndNumber');
  });

  it('requires a matching confirmation', () => {
    expect(errorsOf(signUpAccountSchema, { ...validAccount, confirmPassword: 'Secret124' })).toEqual({
      confirmPassword: ['validation:auth.passwordMismatch'],
    });
    expect(errorsOf(signUpAccountSchema, { ...validAccount, confirmPassword: '' })).toEqual({
      confirmPassword: ['validation:auth.confirmPasswordRequired'],
    });
  });

  it('reports password problems together with other field errors', () => {
    const errors = errorsOf(signUpAccountSchema, { ...validAccount, firstName: '', password: 'short', acceptedTerms: false });
    expect(errors).toEqual({
      firstName: ['validation:auth.firstNameRequired'],
      acceptedTerms: ['validation:auth.termsRequired'],
      password: ['validation:auth.passwordTooShort'],
      confirmPassword: ['validation:auth.passwordMismatch'],
    });
  });

  it('ignores the password fields for Google accounts', () => {
    expect(signUpAccountSchema.safeParse({ ...validAccount, authMethod: 'google', password: '', confirmPassword: '' }).success).toBe(true);
  });
});

describe('names', () => {
  const nameErrors = (firstName: string) => errorsOf(signUpAccountSchema, { ...validAccount, firstName }).firstName;

  it('accepts Latin, Hebrew, Arabic and Cyrillic names with spaces, hyphens and apostrophes', () => {
    for (const name of ['Noa', 'Anne-Marie', "O'Brien", 'O’Neil', 'José', 'נועה', 'בן-דוד', 'ג׳ורג׳', 'محمد', 'Анна', 'Mary Ann']) {
      expect(nameErrors(name)).toBeUndefined();
    }
  });

  it('rejects empty, too short, too long and non-letter names', () => {
    expect(nameErrors('')).toEqual(['validation:auth.firstNameRequired']);
    expect(nameErrors('   ')).toEqual(['validation:auth.firstNameRequired']);
    expect(nameErrors('N')).toEqual(['validation:auth.nameTooShort']);
    expect(nameErrors('a'.repeat(APP_CONFIG.personNameMaxLength + 1))).toEqual(['validation:auth.nameTooLong']);
    for (const name of ['Noa2', 'N@a', '-Noa', '😀😀', "'Noa"]) expect(nameErrors(name)).toEqual(['validation:auth.nameInvalid']);
    expect(errorsOf(signUpAccountSchema, { ...validAccount, lastName: '' }).lastName).toEqual(['validation:auth.lastNameRequired']);
  });

  it('trims and collapses spaces', () => {
    const parsed = signUpAccountSchema.parse({ ...validAccount, firstName: '  Mary   Ann ' });
    expect(parsed.firstName).toBe('Mary Ann');
  });
});

describe('phone and terms', () => {
  it('validates the phone with the shared phone rule', () => {
    for (const phone of ['050-123-4567', '+972 50 123 4567', '+1 (415) 555-0100']) {
      expect(errorsOf(signUpAccountSchema, { ...validAccount, phone }).phone).toBeUndefined();
    }
    expect(errorsOf(signUpAccountSchema, { ...validAccount, phone: '' }).phone).toEqual(['validation:profile.phoneRequired']);
    expect(errorsOf(signUpAccountSchema, { ...validAccount, phone: '12345' }).phone).toEqual(['validation:profile.phoneInvalid']);
  });

  it('requires accepting the terms', () => {
    expect(errorsOf(signUpAccountSchema, { ...validAccount, acceptedTerms: false })).toEqual({
      acceptedTerms: ['validation:auth.termsRequired'],
    });
  });
});

describe('role, services and area steps', () => {
  it('requires a role', () => {
    expect(errorsOf(signUpRoleSchema, { role: null })).toEqual({ role: ['validation:auth.roleRequired'] });
    expect(signUpRoleSchema.safeParse({ role: 'professional' }).success).toBe(true);
  });

  it('requires 1–10 supported services and limits the business name', () => {
    expect(signUpServicesSchema.safeParse({ businessName: '', categoryIds: ['plumbing'] }).success).toBe(true);
    expect(errorsOf(signUpServicesSchema, { businessName: '', categoryIds: [] })).toEqual({ categoryIds: ['validation:category.minOne'] });
    expect(errorsOf(signUpServicesSchema, { businessName: '', categoryIds: ['plumbing', 'nope'] })).toEqual({
      categoryIds: ['validation:category.unsupported'],
    });
    const eleven = ['plumbing', 'electrical', 'handyman', 'painting', 'locksmith', 'moving', 'cleaning', 'gardening', 'pest_control', 'appliance_repair', 'water_heater'];
    expect(errorsOf(signUpServicesSchema, { businessName: '', categoryIds: eleven }).categoryIds).toContain('validation:category.tooMany');
    expect(errorsOf(signUpServicesSchema, { businessName: 'x'.repeat(81), categoryIds: ['plumbing'] })).toEqual({
      businessName: ['validation:profile.businessNameTooLong'],
    });
  });

  it('requires a base location and a radius within the configured bounds', () => {
    expect(signUpAreaSchema.safeParse({ baseLocation: location, serviceRadiusKm: 20 }).success).toBe(true);
    expect(errorsOf(signUpAreaSchema, { baseLocation: null, serviceRadiusKm: 20 })).toEqual({
      baseLocation: ['validation:auth.baseLocationRequired'],
    });
    expect(errorsOf(signUpAreaSchema, { baseLocation: location, serviceRadiusKm: APP_CONFIG.minServiceRadiusKm - 1 })).toEqual({
      serviceRadiusKm: ['validation:profile.radiusTooSmall'],
    });
    expect(errorsOf(signUpAreaSchema, { baseLocation: location, serviceRadiusKm: APP_CONFIG.maxServiceRadiusKm + 1 })).toEqual({
      serviceRadiusKm: ['validation:profile.radiusTooLarge'],
    });
    for (const radius of APP_CONFIG.serviceRadiusPresetsKm) {
      expect(signUpAreaSchema.safeParse({ baseLocation: location, serviceRadiusKm: radius }).success).toBe(true);
    }
  });

  it('has two steps for customers and four for professionals', () => {
    expect(signUpStepsFor('customer')).toEqual(['role', 'account']);
    expect(signUpStepsFor(null)).toEqual(['role', 'account']);
    expect(signUpStepsFor('professional')).toEqual(['role', 'account', 'services', 'area']);
    expect(signUpStepForField('categoryIds')).toBe('services');
    expect(signUpStepForField('baseLocation')).toBe('area');
    expect(signUpStepForField('email')).toBe('account');
  });
});

describe('whole sign-up form', () => {
  it('validates only the customer steps for customers', () => {
    expect(signUpFormSchema.safeParse(signUpValues()).success).toBe(true);
  });

  it('adds the services and area steps for professionals', () => {
    expect(errorsOf(signUpFormSchema, signUpValues({ role: 'professional' }))).toEqual({
      categoryIds: ['validation:category.minOne'],
      baseLocation: ['validation:auth.baseLocationRequired'],
    });
    expect(
      signUpFormSchema.safeParse(signUpValues({ role: 'professional', categoryIds: ['plumbing'], baseLocation: location })).success,
    ).toBe(true);
  });

  it('reports every step at once', () => {
    const errors = errorsOf(signUpFormSchema, createEmptySignUpFormValues());
    expect(Object.keys(errors).sort()).toEqual(
      ['acceptedTerms', 'confirmPassword', 'email', 'firstName', 'lastName', 'password', 'phone', 'role'].sort(),
    );
  });

  it('prefills and locks a Google identity', () => {
    const profile: GoogleProfile = { email: 'maya.katz@gmail.com', firstName: 'Maya', lastName: 'Katz', avatarUrl: null };
    const values = createEmptySignUpFormValues({ role: 'customer', googleProfile: profile });
    expect(values).toMatchObject({ authMethod: 'google', firstName: 'Maya', lastName: 'Katz', email: 'maya.katz@gmail.com' });
    const switched = applyGoogleProfile(signUpValues(), profile);
    expect(switched).toMatchObject({ authMethod: 'google', email: 'maya.katz@gmail.com', password: '', confirmPassword: '' });
    expect(signUpFormSchema.safeParse({ ...switched, phone: '050-123-4567', acceptedTerms: true }).success).toBe(true);
  });
});

describe('toRegisterRequest', () => {
  it('builds a customer payload with a password', () => {
    const request = toRegisterRequest(signUpValues({ email: ' Noa@Example.com ', phone: '050-123 4567' }), { preferredLanguage: 'he' });
    expect(request).toEqual({
      role: 'customer',
      firstName: 'Noa',
      lastName: 'Levi',
      email: 'noa@example.com',
      phone: '0501234567',
      password: 'Secret123',
      googleIdToken: null,
      acceptedTerms: true,
      preferredLanguage: 'he',
      professional: null,
    });
    expect(registerRequestSchema.safeParse(request).success).toBe(true);
  });

  it('builds a professional payload with a Google token', () => {
    const request = toRegisterRequest(
      signUpValues({
        role: 'professional',
        authMethod: 'google',
        password: '',
        confirmPassword: '',
        businessName: '  ',
        categoryIds: ['plumbing', 'water_heater'],
        baseLocation: { ...location, neighborhood: ' ', details: ' Floor 2 ' },
        serviceRadiusKm: 40,
      }),
      { preferredLanguage: 'en', googleIdToken: 'mock-google.token' },
    );
    expect(request.password).toBeNull();
    expect(request.googleIdToken).toBe('mock-google.token');
    expect(request.professional).toEqual({
      businessName: null,
      categoryIds: ['plumbing', 'water_heater'],
      baseLocation: { ...location, neighborhood: null, details: 'Floor 2' },
      serviceRadiusKm: 40,
    });
    expect(registerRequestSchema.safeParse(request).success).toBe(true);
  });

  it('refuses values that could not have passed validation', () => {
    expect(() => toRegisterRequest(signUpValues({ role: null }), { preferredLanguage: 'en' })).toThrow();
    expect(() => toRegisterRequest(signUpValues({ acceptedTerms: false }), { preferredLanguage: 'en' })).toThrow();
  });
});

describe('registerRequestSchema (server)', () => {
  const base = toRegisterRequest(signUpValues(), { preferredLanguage: 'en' });

  it('needs exactly one of password and Google token', () => {
    expect(errorsOf(registerRequestSchema, { ...base, password: null })).toEqual({ password: ['validation:auth.passwordRequired'] });
    expect(errorsOf(registerRequestSchema, { ...base, password: 'weakpassword' })).toEqual({
      password: ['validation:auth.passwordLetterAndNumber'],
    });
    expect(errorsOf(registerRequestSchema, { ...base, googleIdToken: 'mock-google.x' })).toEqual({ googleIdToken: ['validation:invalid'] });
    expect(registerRequestSchema.safeParse({ ...base, password: null, googleIdToken: 'mock-google.x' }).success).toBe(true);
  });

  it('requires accepted terms and matching professional details', () => {
    expect(errorsOf(registerRequestSchema, { ...base, acceptedTerms: false })).toEqual({ acceptedTerms: ['validation:auth.termsRequired'] });
    expect(errorsOf(registerRequestSchema, { ...base, role: 'professional' })).toEqual({
      professional: ['validation:auth.professionalDetailsRequired'],
    });
    const professional = { businessName: null, categoryIds: ['plumbing'], baseLocation: location, serviceRadiusKm: 20 };
    expect(errorsOf(registerRequestSchema, { ...base, professional })).toEqual({ professional: ['validation:invalid'] });
    expect(errorsOf(registerRequestSchema, { ...base, role: 'professional', professional: { ...professional, categoryIds: ['nope'] } })).toEqual({
      'professional.categoryIds.0': ['validation:category.unsupported'],
    });
  });

  it('maps server field errors onto the sign-up form', () => {
    expect(
      registerFieldErrorsToForm({
        email: ['validation:auth.emailTaken'],
        'professional.categoryIds.0': ['validation:category.unsupported'],
        'professional.baseLocation.addressLine': ['validation:location.addressRequired'],
        'professional.serviceRadiusKm': ['validation:profile.radiusTooLarge'],
        unknown: ['x'],
      }),
    ).toEqual({
      email: 'validation:auth.emailTaken',
      categoryIds: 'validation:category.unsupported',
      baseLocation: 'validation:location.addressRequired',
      serviceRadiusKm: 'validation:profile.radiusTooLarge',
    });
    expect(registerFieldErrorsToForm(undefined)).toEqual({});
  });
});

describe('simulated Google account', () => {
  it('validates the "use another account" fields', () => {
    expect(simulatedGoogleAccountSchema.parse({ firstName: 'Maya', lastName: 'Katz', email: 'Maya@Gmail.com' }).email).toBe('maya@gmail.com');
    expect(Object.keys(errorsOf(simulatedGoogleAccountSchema, { firstName: '', lastName: '', email: 'x' })).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
    ]);
  });
});
