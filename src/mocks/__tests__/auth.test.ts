import { requestAcceptsOffers } from '@/features/requests/request-status-machine';
import { ApiClient } from '@/services/api/client';
import { createAuthApi } from '@/services/api/endpoints/auth';
import { buildMockGoogleIdToken, mockGoogleSubject } from '@/services/auth/google-id-token';
import type { RegisterRequest } from '@/types/api';
import { base64UrlEncodeText } from '@/utils/encoding';

import { DEMO_CUSTOMER_IDS, PRO_IDS } from '../data/seed';
import { createAccessToken } from '../server/auth';
import { DEMO_ACCOUNT_PASSWORD, DEMO_SIGN_IN_EMAIL } from '../server/passwords';
import { createMockTransport } from '../transport';
import { createTestEnvironment, expectApiError, minutesFromNow, type TestEnvironment } from '../testing/test-server';

const location = {
  coordinates: { latitude: 32.0853, longitude: 34.7818 },
  addressLine: 'Dizengoff St 120',
  city: 'Tel Aviv-Yafo',
  neighborhood: null,
  details: null,
};

function customerRequest(overrides: Partial<RegisterRequest> = {}): RegisterRequest {
  return {
    role: 'customer',
    firstName: 'Tal',
    lastName: 'Harel',
    email: 'tal.harel@example.org',
    phone: '0501234567',
    password: 'Secret123',
    googleIdToken: null,
    acceptedTerms: true,
    preferredLanguage: 'he',
    professional: null,
    ...overrides,
  };
}

/** A JWT-shaped token (unsigned) with the given payload. */
function fakeJwt(payload: Record<string, unknown>): string {
  return `${base64UrlEncodeText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64UrlEncodeText(JSON.stringify(payload))}.signature`;
}

describe('email + password accounts', () => {
  let env: TestEnvironment;
  const anonymous = () => env.as(null).auth;
  const db = () => env.server.internals.db;

  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('suggests a demo account that signs in with the demo password', async () => {
    await expect(anonymous().login({ email: DEMO_SIGN_IN_EMAIL, password: DEMO_ACCOUNT_PASSWORD })).resolves.toMatchObject({
      user: { id: DEMO_CUSTOMER_IDS.noa, role: 'customer' },
    });
  });

  it('lets every seeded account sign in with the demo password', async () => {
    const accounts = await anonymous().getDemoAccounts();
    expect(accounts.length).toBeGreaterThan(0);
    for (const account of accounts) {
      const email = db().users.require(account.userId, 'User').email;
      const session = await anonymous().login({ email, password: DEMO_ACCOUNT_PASSWORD });
      expect(session.accessToken).toBe(createAccessToken(account.userId));
      expect(session.user).toMatchObject({ id: account.userId, role: account.role });
      expect(session.user).not.toHaveProperty('isDemo');
    }
    // Every seeded user has a credential keyed by the lower-cased email.
    for (const user of db().users.all()) expect(db().credentials.get(user.email.toLowerCase())?.userId).toBe(user.id);
    // Non-demo seeded users can sign in too.
    await expect(anonymous().login({ email: 'tamar.shalev@example.com', password: DEMO_ACCOUNT_PASSWORD })).resolves.toMatchObject({
      user: { id: 'user_tamar_shalev' },
    });
  });

  it('matches emails case-insensitively', async () => {
    const session = await anonymous().login({ email: '  NOA.Levi@Example.com ', password: DEMO_ACCOUNT_PASSWORD });
    expect(session.user.id).toBe(DEMO_CUSTOMER_IDS.noa);
  });

  it('answers 401 INVALID_CREDENTIALS for a wrong password or an unknown email', async () => {
    const wrongPassword = await expectApiError(anonymous().login({ email: 'noa.levi@example.com', password: 'demo1234' }));
    const unknownEmail = await expectApiError(anonymous().login({ email: 'nobody@example.com', password: DEMO_ACCOUNT_PASSWORD }));
    expect(wrongPassword).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(unknownEmail).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(unknownEmail.message).toBe(wrongPassword.message);
    expect(await expectApiError(anonymous().login({ email: 'not-an-email', password: 'x' }))).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
    });
  });

  it('registers a customer and signs in', async () => {
    const session = await anonymous().register(customerRequest({ email: 'Tal.Harel@Example.org' }));
    expect(session.user).toMatchObject({
      role: 'customer',
      firstName: 'Tal',
      lastName: 'Harel',
      displayName: 'Tal Harel',
      email: 'tal.harel@example.org',
      phone: '0501234567',
      preferredLanguage: 'he',
      avatarUrl: null,
    });
    const me = await env.as(session.user.id).auth.getCurrentUser();
    expect(me.user.id).toBe(session.user.id);
    expect(me.customerProfile).toMatchObject({ userId: session.user.id, defaultLocation: null, savedLocations: [] });
    await expect(env.as(session.user.id).dashboard.getCustomerDashboard()).resolves.toMatchObject({ openRequestsCount: 0 });

    // The new account signs in with its password and is not a demo account.
    await expect(anonymous().login({ email: 'tal.harel@example.org', password: 'Secret123' })).resolves.toMatchObject({
      user: { id: session.user.id },
    });
    expect((await anonymous().getDemoAccounts()).some((account) => account.userId === session.user.id)).toBe(false);
  });

  it('registers a professional who immediately matches open requests', async () => {
    const open = db().requests.find((request) => requestAcceptsOffers(request.status));
    expect(open).toBeDefined();
    const target = open!;
    const session = await anonymous().register(
      customerRequest({
        role: 'professional',
        email: 'gal.pro@example.org',
        professional: {
          businessName: null,
          categoryIds: [target.categoryId],
          baseLocation: { ...location, coordinates: { ...target.location.coordinates } },
          serviceRadiusKm: 10,
        },
      }),
    );
    expect(session.user).toMatchObject({ role: 'professional', displayName: 'Tal Harel' });
    const pro = env.as(session.user.id);

    const own = await pro.professionals.getOwnProfessionalProfile();
    expect(own).toMatchObject({
      userId: session.user.id,
      fullName: 'Tal Harel',
      displayName: 'Tal Harel',
      categoryIds: [target.categoryId],
      serviceArea: { center: target.location.coordinates, radiusKm: 10, label: 'Tel Aviv-Yafo' },
      baseLocation: { addressLine: 'Dizengoff St 120', isApproximate: false },
      contact: { email: 'gal.pro@example.org', phone: '0501234567', website: null },
      business: { businessName: null, languages: ['he'], isInsured: false },
      stats: { averageRating: null, reviewCount: 0, completedJobsCount: 0 },
      isVerified: false,
    });
    expect(own.availability.days.sun.enabled).toBe(true);
    expect(own.notificationPreferences.newRequests).toBe(true);

    const nearby = await pro.requests.getNearbyOpenRequests();
    expect(nearby.items.map((request) => request.id)).toContain(target.id);
    const dashboard = await pro.dashboard.getProfessionalDashboard();
    expect(dashboard.nearbyOpenRequestsCount).toBeGreaterThan(0);

    // The new professional can take part in the marketplace right away.
    const offer = await pro.offers.createOffer(target.id, {
      price: 350,
      currency: 'ILS',
      proposedStartAt: minutesFromNow(env, 120),
      estimatedDurationMinutes: 60,
      message: null,
    });
    expect(offer.professionalId).toBe(own.id);
    await expect(env.as(target.customerId).professionals.getProfessionalProfile(own.id)).resolves.toMatchObject({
      displayName: 'Tal Harel',
    });
  });

  it('uses the business name as the professional display name', async () => {
    const session = await anonymous().register(
      customerRequest({
        role: 'professional',
        email: 'biz@example.org',
        professional: { businessName: 'Harel Fix', categoryIds: ['plumbing'], baseLocation: location, serviceRadiusKm: 20 },
      }),
    );
    expect(session.user.displayName).toBe('Harel Fix');
    await expect(env.as(session.user.id).professionals.getOwnProfessionalProfile()).resolves.toMatchObject({
      fullName: 'Tal Harel',
      displayName: 'Harel Fix',
      business: { businessName: 'Harel Fix' },
    });
  });

  it('rejects a registered email with 409 EMAIL_ALREADY_REGISTERED on the email field', async () => {
    for (const email of ['noa.levi@example.com', 'NOA.LEVI@example.com', 'avi@aquafix.example.com']) {
      const error = await expectApiError(anonymous().register(customerRequest({ email })));
      expect(error).toMatchObject({ status: 409, code: 'EMAIL_ALREADY_REGISTERED', fieldErrors: { email: ['validation:auth.emailTaken'] } });
    }
    await anonymous().register(customerRequest());
    expect(await expectApiError(anonymous().register(customerRequest({ role: 'customer', firstName: 'Other' })))).toMatchObject({
      status: 409,
    });
  });

  it('validates the payload with the shared schema and rolls back failures', async () => {
    const usersBefore = db().users.size;
    const error = await expectApiError(
      anonymous().register(customerRequest({ password: 'short', firstName: '', role: 'professional' })),
    );
    expect(error).toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
    expect(error.fieldErrors).toMatchObject({
      firstName: ['validation:auth.firstNameRequired'],
      password: ['validation:auth.passwordTooShort'],
      professional: ['validation:auth.professionalDetailsRequired'],
    });
    const unsupported = await expectApiError(
      anonymous().register(
        customerRequest({
          role: 'professional',
          professional: { businessName: null, categoryIds: ['nope' as 'plumbing'], baseLocation: location, serviceRadiusKm: 20 },
        }),
      ),
    );
    expect(unsupported).toMatchObject({ status: 422, code: 'UNSUPPORTED_CATEGORY' });
    expect(db().users.size).toBe(usersBefore);
  });

  it('never stores plaintext passwords', async () => {
    const password = 'Plaintext987';
    const session = await anonymous().register(customerRequest({ password }));
    const credential = db().credentials.require('tal.harel@example.org', 'Credential');
    expect(credential).toMatchObject({ userId: session.user.id, googleSubject: null });
    expect(credential.passwordHash).toMatch(/^sha256\$[0-9a-f]{16}\$[0-9a-f]{64}$/);
    const dump = JSON.stringify(db().exportTables());
    expect(dump).not.toContain(password);
    expect(dump).not.toContain(DEMO_ACCOUNT_PASSWORD);
    // Salted: two accounts with the same password get different hashes.
    await anonymous().register(customerRequest({ email: 'twin@example.org', password }));
    expect(db().credentials.require('twin@example.org', 'Credential').passwordHash).not.toBe(credential.passwordHash);
  });

  it('never changes the sign-in email when a professional edits the public contact email', async () => {
    const avi = env.as(PRO_IDS.avi);
    const profile = await avi.professionals.getOwnProfessionalProfile();
    const updated = await avi.professionals.updateProfessionalProfile({ contact: { ...profile.contact, email: 'office@aquafix.example.com' } });
    expect(updated.contact.email).toBe('office@aquafix.example.com');
    await expect(anonymous().login({ email: 'avi@aquafix.example.com', password: DEMO_ACCOUNT_PASSWORD })).resolves.toMatchObject({
      user: { id: PRO_IDS.avi, email: 'avi@aquafix.example.com' },
    });
    expect(await expectApiError(anonymous().login({ email: 'office@aquafix.example.com', password: DEMO_ACCOUNT_PASSWORD }))).toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('accepts every password reset request for a valid email', async () => {
    await expect(anonymous().requestPasswordReset({ email: 'noa.levi@example.com' })).resolves.toEqual({ success: true });
    await expect(anonymous().requestPasswordReset({ email: 'nobody@example.com' })).resolves.toEqual({ success: true });
    expect(await expectApiError(anonymous().requestPasswordReset({ email: 'nope' }))).toMatchObject({
      status: 422,
      fieldErrors: { email: ['validation:auth.emailInvalid'] },
    });
  });
});

describe('Google accounts', () => {
  let env: TestEnvironment;
  const anonymous = () => env.as(null).auth;
  const maya = { email: 'maya.katz@gmail.com', firstName: 'Maya', lastName: 'Katz', avatarUrl: 'https://example.com/maya.png' };

  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('asks a new Google user to finish signing up, then signs them in', async () => {
    const idToken = buildMockGoogleIdToken(maya);
    const first = await anonymous().signInWithGoogle({ idToken });
    expect(first).toEqual({
      status: 'registration_required',
      profile: { email: 'maya.katz@gmail.com', firstName: 'Maya', lastName: 'Katz', avatarUrl: 'https://example.com/maya.png' },
    });

    const session = await anonymous().register(
      customerRequest({ firstName: 'Maya', lastName: 'Katz', email: 'maya.katz@gmail.com', password: null, googleIdToken: idToken }),
    );
    expect(session.user).toMatchObject({ role: 'customer', email: 'maya.katz@gmail.com', avatarUrl: 'https://example.com/maya.png' });
    expect(env.server.internals.db.credentials.require('maya.katz@gmail.com', 'Credential')).toMatchObject({
      passwordHash: null,
      googleSubject: mockGoogleSubject('maya.katz@gmail.com'),
    });

    const again = await anonymous().signInWithGoogle({ idToken });
    expect(again).toMatchObject({ status: 'signed_in', session: { user: { id: session.user.id } } });
    // Google-only accounts can't sign in with a password.
    expect(await expectApiError(anonymous().login({ email: 'maya.katz@gmail.com', password: 'Secret123' }))).toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    // The Google identity can't create a second account.
    expect(
      await expectApiError(
        anonymous().register(customerRequest({ email: 'maya.katz@gmail.com', password: null, googleIdToken: idToken })),
      ),
    ).toMatchObject({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('signs an existing account straight in and links the Google identity', async () => {
    const idToken = buildMockGoogleIdToken({ email: 'Noa.Levi@example.com', firstName: 'Noa', lastName: 'Levi' });
    const response = await anonymous().signInWithGoogle({ idToken });
    expect(response).toMatchObject({
      status: 'signed_in',
      session: { accessToken: createAccessToken(DEMO_CUSTOMER_IDS.noa), user: { id: DEMO_CUSTOMER_IDS.noa, role: 'customer' } },
    });
    expect(env.server.internals.db.credentials.require('noa.levi@example.com', 'Credential').googleSubject).toBe(
      mockGoogleSubject('noa.levi@example.com'),
    );
    // Her (verified) password keeps working.
    await expect(anonymous().login({ email: 'noa.levi@example.com', password: DEMO_ACCOUNT_PASSWORD })).resolves.toBeDefined();
  });

  it('matches a linked Google account by its id only, never by the email alone', async () => {
    const idToken = buildMockGoogleIdToken(maya);
    await anonymous().register(customerRequest({ firstName: 'Maya', lastName: 'Katz', email: maya.email, password: null, googleIdToken: idToken }));
    // Another Google account with the same address (e.g. recycled) can't take the account over.
    const exp = Math.floor(env.clock.now().getTime() / 1000) + 3600;
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    try {
      const otherGoogleAccount = fakeJwt({
        iss: 'accounts.google.com',
        aud: 'test-client.apps.googleusercontent.com',
        sub: 'someone-else',
        email: maya.email,
        email_verified: true,
        exp,
      });
      expect(await expectApiError(anonymous().signInWithGoogle({ idToken: otherGoogleAccount }))).toMatchObject({
        status: 401,
        code: 'INVALID_GOOGLE_TOKEN',
      });
    } finally {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    }
  });

  it('drops an unverified password when the owner of the email signs in with Google', async () => {
    // Someone registers the address with a password before its owner ever signs up…
    const squatter = await anonymous().register(customerRequest({ email: maya.email, password: 'Squatter99' }));
    expect(env.server.internals.db.credentials.require(maya.email, 'Credential')).toMatchObject({ emailVerified: false });
    // …then the owner uses "Continue with Google": signed in, and the unverified password is gone.
    const response = await anonymous().signInWithGoogle({ idToken: buildMockGoogleIdToken(maya) });
    expect(response).toMatchObject({ status: 'signed_in', session: { user: { id: squatter.user.id } } });
    expect(env.server.internals.db.credentials.require(maya.email, 'Credential')).toMatchObject({
      passwordHash: null,
      emailVerified: true,
      googleSubject: mockGoogleSubject(maya.email),
    });
    expect(await expectApiError(anonymous().login({ email: maya.email, password: 'Squatter99' }))).toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('accepts an unexpired Google JWT for the app’s own client id in the mock backend', async () => {
    const exp = Math.floor(env.clock.now().getTime() / 1000) + 3600;
    const claims = { iss: 'https://accounts.google.com', sub: '1234567890', email: 'real.user@gmail.com', email_verified: true, given_name: 'Real', family_name: 'User', exp };
    // No client id configured: no real Google token is accepted.
    expect(await expectApiError(anonymous().signInWithGoogle({ idToken: fakeJwt({ ...claims, aud: 'any' }) }))).toMatchObject({
      code: 'INVALID_GOOGLE_TOKEN',
    });
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    try {
      await expect(anonymous().signInWithGoogle({ idToken: fakeJwt({ ...claims, aud: 'test-client.apps.googleusercontent.com' }) })).resolves.toMatchObject({
        status: 'registration_required',
        profile: { email: 'real.user@gmail.com', firstName: 'Real', lastName: 'User', avatarUrl: null },
      });
      // Minted for another app.
      expect(await expectApiError(anonymous().signInWithGoogle({ idToken: fakeJwt({ ...claims, aud: 'other-app' }) }))).toMatchObject({
        code: 'INVALID_GOOGLE_TOKEN',
      });
    } finally {
      delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    }
  });

  it('answers 401 INVALID_GOOGLE_TOKEN for tokens it can’t verify', async () => {
    const exp = Math.floor(env.clock.now().getTime() / 1000) + 3600;
    const expired = exp - 7200;
    const invalid = [
      'garbage',
      'mock-google.',
      'mock-google.%%%',
      `mock-google.${base64UrlEncodeText(JSON.stringify({ sub: 'x', email: 'not-an-email' }))}`,
      `mock-google.${base64UrlEncodeText('not json')}`,
      fakeJwt({ iss: 'https://evil.example.com', sub: '1', email: 'a@b.co', email_verified: true, exp }),
      fakeJwt({ iss: 'accounts.google.com', sub: '1', email: 'a@b.co', email_verified: true, exp: expired }),
      fakeJwt({ iss: 'accounts.google.com', sub: '1', email: 'a@b.co', email_verified: false, exp }),
    ];
    for (const idToken of invalid) {
      expect(await expectApiError(anonymous().signInWithGoogle({ idToken }))).toMatchObject({ status: 401, code: 'INVALID_GOOGLE_TOKEN' });
    }
    expect(await expectApiError(anonymous().signInWithGoogle({ idToken: '' }))).toMatchObject({ status: 422 });
  });

  it('requires the Google account to match the registered email', async () => {
    const idToken = buildMockGoogleIdToken(maya);
    const error = await expectApiError(
      anonymous().register(customerRequest({ email: 'someone.else@gmail.com', password: null, googleIdToken: idToken })),
    );
    expect(error).toMatchObject({ status: 401, code: 'INVALID_GOOGLE_TOKEN' });
    expect(env.server.internals.db.credentials.has('someone.else@gmail.com')).toBe(false);
  });
});

describe('API client', () => {
  it('does not sign anyone out for a 401 from the auth endpoints', async () => {
    const env = await createTestEnvironment();
    const { transport } = createMockTransport(env.server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 });
    const onUnauthorized = jest.fn();
    const auth = createAuthApi(new ApiClient({ transport, onUnauthorized, getAccessToken: () => null }));
    await expectApiError(auth.login({ email: 'noa.levi@example.com', password: 'wrong-password' }));
    await expectApiError(auth.signInWithGoogle({ idToken: 'garbage' }));
    expect(onUnauthorized).not.toHaveBeenCalled();
    // Any other 401 still signs out.
    await expectApiError(auth.getCurrentUser());
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('exempts only requests marked as public sign-in, not every /auth/* path', async () => {
    const onUnauthorized = jest.fn();
    const client = new ApiClient({
      transport: () => Promise.resolve({ status: 401, data: { code: 'UNAUTHORIZED', message: 'Expired' } }),
      onUnauthorized,
    });
    await expectApiError(client.post('/auth/login', {}, { skipUnauthorizedHandler: true }));
    expect(onUnauthorized).not.toHaveBeenCalled();
    // e.g. a future authenticated endpoint: an expired session still signs out.
    await expectApiError(client.post('/auth/change-password', {}));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
