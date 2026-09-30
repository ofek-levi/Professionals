import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { createCustomer } from '../../../../test/factories.js';
import { sha256 } from '../../../lib/crypto.js';
import { ProfessionalModel } from '../../professionals/professional.model.js';
import { UserModel } from '../../users/user.model.js';
import { SessionModel } from '../session.model.js';
import { customerPayload, linkSentTo, professionalPayload, registerAccount } from './auth-test-helpers.js';

describe('POST /v1/auth/register', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(clearDatabase);

  it('creates a customer, signs in and sends a verification email', async () => {
    const payload = customerPayload({ email: '  Noa.Levi@Example.com ', firstName: '  Noa  ', preferredLanguage: 'he' });
    const session = await registerAccount(app, payload);

    expect(session).toEqual({
      accessToken: expect.any(String),
      accessTokenExpiresAt: '2026-10-01T09:30:00.000Z',
      refreshToken: expect.stringMatching(/^[0-9a-f]{24}\.[\w-]{43}\.[\w-]{22}$/),
      user: {
        id: expect.any(String),
        role: 'customer',
        firstName: 'Noa',
        lastName: 'Levi',
        displayName: 'Noa Levi',
        email: 'noa.levi@example.com',
        phone: '050-123-4567',
        avatarUrl: null,
        preferredLanguage: 'he',
        createdAt: '2026-10-01T09:00:00.000Z',
      },
    });
    const user = await UserModel.findById(session.user.id).lean();
    expect(user?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(user?.emailVerifiedAt).toBeUndefined();
    expect(user?.notificationPreferences).toEqual({
      pushEnabled: true,
      emailEnabled: false,
      jobUpdates: true,
      messages: true,
      newRequests: true,
      reminders: true,
    });
    expect(await ProfessionalModel.countDocuments()).toBe(0);
    // Only the hash of the refresh token is stored.
    expect(await SessionModel.countDocuments({ user: user?._id, tokenHash: sha256(session.refreshToken) })).toBe(1);

    const { mail, url } = await linkSentTo(deps, 'noa.levi@example.com');
    expect(mail.subject).toBe('אישור כתובת האימייל שלכם');
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.text).toContain(url.href);
    expect(url.origin + url.pathname).toBe('http://api.test/v1/auth/verify-email');

    const me = await request(app).get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`).expect(200);
    expect(me.body.customerProfile).toMatchObject({ defaultLocation: null, savedLocations: [], stats: { requestsCount: 0, completedJobsCount: 0 } });
  });

  it('creates a professional with the profile built from the sign-up details', async () => {
    const session = await registerAccount(app, professionalPayload({ email: 'avi@example.com' }));
    expect(session.user).toMatchObject({ role: 'professional', displayName: 'Avi Fix', preferredLanguage: 'he' });

    const profile = await ProfessionalModel.findById(session.user.id).lean();
    expect(profile).toMatchObject({
      displayName: 'Avi Fix',
      headline: '',
      bio: '',
      categoryIds: ['plumbing', 'handyman'],
      yearsOfExperience: 0,
      serviceArea: { center: { type: 'Point', coordinates: [34.7818, 32.0853] }, radiusKm: 15, label: 'Tel Aviv-Yafo' },
      baseLocation: { addressLine: 'Ibn Gabirol St 50', city: 'Tel Aviv-Yafo', neighborhood: null, details: null },
      contact: { phone: '050-123-4567', email: 'avi@example.com', website: null },
      business: { businessName: 'Avi Fix', licenseNumber: null, isInsured: false, languages: ['he'] },
      startingPrice: null,
      isVerified: false,
      stats: { averageRating: null, reviewCount: 0, completedJobsCount: 0, responseTimeMinutes: null },
    });
    expect(profile?.availability.days.sat.enabled).toBe(false);

    const me = await request(app).get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`).expect(200);
    expect(me.body.user.displayName).toBe('Avi Fix');
    expect(me.body.professionalProfile).toMatchObject({ id: session.user.id, userId: session.user.id, fullName: 'Avi Cohen' });
  });

  it('uses the full name as display name without a business name', async () => {
    const payload = professionalPayload();
    const session = await registerAccount(app, { ...payload, professional: { ...(payload.professional as object), businessName: '  ' } });
    expect(session.user.displayName).toBe('Avi Cohen');
    expect(await ProfessionalModel.findById(session.user.id, { displayName: 1, business: 1 }).lean()).toMatchObject({
      displayName: 'Avi Cohen',
      business: { businessName: null },
    });
  });

  it('answers 409 EMAIL_ALREADY_REGISTERED for a taken address (any case)', async () => {
    await createCustomer({ email: 'taken@example.com' });
    const res = await request(app).post('/v1/auth/register').send(customerPayload({ email: 'TAKEN@example.com' })).expect(409);
    expect(res.body).toEqual({
      code: 'EMAIL_ALREADY_REGISTERED',
      message: expect.any(String),
      fieldErrors: { email: ['validation:auth.emailTaken'] },
    });
  });

  it('lets only one of two concurrent sign-ups with the same address through', async () => {
    const payload = professionalPayload({ email: 'race@example.com' });
    const results = await Promise.all([1, 2].map(() => request(app).post('/v1/auth/register').send(payload)));
    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await UserModel.countDocuments({ email: 'race@example.com' })).toBe(1);
    expect(await ProfessionalModel.countDocuments()).toBe(1);
    expect(await SessionModel.countDocuments()).toBe(1);
  });

  it('reports every invalid field with the app’s message keys', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        role: 'professional',
        firstName: ' ',
        lastName: 'L',
        email: 'not-an-email',
        phone: '123',
        password: 'password1',
        googleIdToken: null,
        acceptedTerms: false,
        preferredLanguage: 'fr',
        professional: null,
      })
      .expect(400);
    expect(res.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
      fieldErrors: {
        firstName: ['validation:auth.firstNameRequired'],
        lastName: ['validation:auth.nameTooShort'],
        email: ['validation:auth.emailInvalid'],
        phone: ['validation:profile.phoneInvalid'],
        acceptedTerms: ['validation:auth.termsRequired'],
        preferredLanguage: ['validation:invalid'],
        password: ['validation:auth.passwordTooCommon'],
        professional: ['validation:auth.professionalDetailsRequired'],
      },
    });
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('refuses a password found in a data breach with the "too common" message', async () => {
    deps.passwordBreach.breached.add('Breached-Pass-77');
    const res = await request(app).post('/v1/auth/register').send(customerPayload({ password: 'Breached-Pass-77' })).expect(400);
    expect(res.body.fieldErrors).toEqual({ password: ['validation:auth.passwordTooCommon'] });
    expect(await UserModel.countDocuments()).toBe(0);
    // Google sign-ups have no password to check.
    const token = deps.google.issue({ email: 'google.user@example.com' });
    await request(app)
      .post('/v1/auth/register')
      .send(customerPayload({ email: 'google.user@example.com', password: null, googleIdToken: token }))
      .expect(201);
  });

  it('validates the professional details (paths as the app maps them)', async () => {
    const payload = professionalPayload();
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        ...payload,
        professional: {
          businessName: 'x'.repeat(81),
          categoryIds: [],
          baseLocation: { coordinates: { latitude: 99, longitude: 34 }, addressLine: '', city: 'Tel Aviv', neighborhood: null, details: null },
          serviceRadiusKm: 1,
        },
      })
      .expect(400);
    expect(res.body.fieldErrors).toEqual({
      'professional.businessName': ['validation:profile.businessNameTooLong'],
      'professional.categoryIds': ['validation:category.minOne'],
      'professional.baseLocation.coordinates': ['validation:location.coordinatesInvalid'],
      'professional.baseLocation.addressLine': ['validation:location.addressRequired'],
      'professional.serviceRadiusKm': ['validation:profile.radiusTooSmall'],
    });
  });

  it('answers 422 UNSUPPORTED_CATEGORY for a category outside the catalog', async () => {
    const payload = professionalPayload();
    const professional = { ...(payload.professional as object), categoryIds: ['plumbing', 'astrology'] };
    const res = await request(app).post('/v1/auth/register').send({ ...payload, professional }).expect(422);
    expect(res.body).toMatchObject({ code: 'UNSUPPORTED_CATEGORY', fieldErrors: { 'professional.categoryIds.1': ['validation:category.unsupported'] } });
  });

  describe('with Google', () => {
    it('creates a verified account without a password and no verification email', async () => {
      const idToken = deps.google.issue({ email: 'dana@example.com', sub: 'google-dana', avatarUrl: 'https://lh3.test/dana.jpg' });
      const session = await registerAccount(app, customerPayload({ email: 'dana@example.com', password: null, googleIdToken: idToken }));
      expect(session.user.avatarUrl).toBe('https://lh3.test/dana.jpg');

      const user = await UserModel.findById(session.user.id).lean();
      expect(user).toMatchObject({ googleSub: 'google-dana', emailVerifiedAt: new Date('2026-10-01T09:00:00.000Z') });
      expect(user?.passwordHash).toBeUndefined();
      await deps.background.drain();
      expect(deps.mailer.lastTo('dana@example.com')).toBeUndefined();
    });

    it('refuses a token of another address, an invalid token and a Google account already in use', async () => {
      const other = deps.google.issue({ email: 'other@example.com' });
      const mismatch = await request(app).post('/v1/auth/register').send(customerPayload({ password: null, googleIdToken: other })).expect(401);
      expect(mismatch.body.code).toBe('INVALID_GOOGLE_TOKEN');

      await request(app).post('/v1/auth/register').send(customerPayload({ password: null, googleIdToken: 'forged' })).expect(401);

      await createCustomer({ email: 'first@example.com', googleSub: 'google-shared' });
      const reused = deps.google.issue({ email: 'second@example.com', sub: 'google-shared' });
      const res = await request(app)
        .post('/v1/auth/register')
        .send(customerPayload({ email: 'second@example.com', password: null, googleIdToken: reused }))
        .expect(409);
      expect(res.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('rejects a payload with both a password and a Google token', async () => {
      const idToken = deps.google.issue({ email: 'both@example.com' });
      const res = await request(app).post('/v1/auth/register').send(customerPayload({ email: 'both@example.com', googleIdToken: idToken })).expect(400);
      expect(res.body.fieldErrors).toEqual({ googleIdToken: ['validation:invalid'] });
    });
  });
});
