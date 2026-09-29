import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createCustomer, createJob, createOffer, createProfessional, createRequest, createUpload } from '../../../../test/factories.js';
import { UploadModel } from '../../uploads/upload.model.js';
import { UserModel } from '../../users/user.model.js';

const HOME = {
  coordinates: { latitude: 32.0853, longitude: 34.7818 },
  addressLine: 'Dizengoff St 120',
  city: 'Tel Aviv-Yafo',
  neighborhood: '',
  details: ' Floor 2 ',
};

const PREFERENCES = { pushEnabled: false, emailEnabled: true, jobUpdates: true, messages: false, newRequests: true, reminders: false };

describe('GET /v1/customer/profile', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('returns the account and the profile with live stats', async () => {
    const customer = await signInCustomer(deps, { firstName: 'Noa', lastName: 'Levi' });
    const { professional } = await createProfessional();
    await createRequest(customer.user, { status: 'draft', publishedAt: null });
    const open = await createRequest(customer.user);
    const done = await createRequest(customer.user, { status: 'completed' });
    await createJob(done, await createOffer(done, professional), { status: 'completed' });
    await createRequest(await createCustomer());

    const res = await request(app).get('/v1/customer/profile').set(customer.headers).expect(200);
    expect(res.body.user).toEqual({
      id: customer.user._id.toHexString(),
      role: 'customer',
      firstName: 'Noa',
      lastName: 'Levi',
      displayName: 'Noa Levi',
      email: customer.user.email,
      phone: customer.user.phone,
      avatarUrl: null,
      preferredLanguage: 'en',
      createdAt: customer.user.createdAt.toISOString(),
    });
    expect(res.body.profile).toEqual({
      userId: customer.user._id.toHexString(),
      defaultLocation: {
        coordinates: { latitude: 32.0853, longitude: 34.7818 },
        addressLine: 'Dizengoff St 120',
        city: 'Tel Aviv-Yafo',
        neighborhood: 'Old North',
        details: 'Floor 3',
        isApproximate: false,
      },
      savedLocations: [],
      notificationPreferences: customer.user.notificationPreferences,
      stats: { requestsCount: 2, completedJobsCount: 1 },
      updatedAt: customer.user.updatedAt.toISOString(),
    });
    expect(open.status).toBe('open');
  });

  it('is only for signed-in customers', async () => {
    await request(app).get('/v1/customer/profile').expect(401);
    const pro = await signInProfessional(deps);
    const res = await request(app).get('/v1/customer/profile').set(pro.headers).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
    await request(app).patch('/v1/customer/profile').set(pro.headers).send({ firstName: 'X' }).expect(403);
  });
});

describe('PATCH /v1/customer/profile', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('updates the given fields only', async () => {
    const customer = await signInCustomer(deps);
    deps.clock.advanceMinutes(5);
    const res = await request(app)
      .patch('/v1/customer/profile')
      .set(customer.headers)
      .send({ firstName: ' Dana ', phone: '0541234567', defaultLocation: { ...HOME, isApproximate: true }, notificationPreferences: PREFERENCES })
      .expect(200);

    expect(res.body.user).toMatchObject({ firstName: 'Dana', lastName: customer.user.lastName, displayName: `Dana ${customer.user.lastName}`, phone: '0541234567' });
    expect(res.body.profile).toMatchObject({
      defaultLocation: { ...HOME, neighborhood: null, details: 'Floor 2', isApproximate: false },
      notificationPreferences: PREFERENCES,
      updatedAt: deps.clock.now().toISOString(),
    });
    const stored = await UserModel.findById(customer.user._id).lean();
    expect(stored).toMatchObject({ firstName: 'Dana', email: customer.user.email, defaultLocation: { point: { type: 'Point', coordinates: [34.7818, 32.0853] } } });

    const cleared = await request(app).patch('/v1/customer/profile').set(customer.headers).send({ defaultLocation: null }).expect(200);
    expect(cleared.body.profile.defaultLocation).toBeNull();
    expect(cleared.body.user.firstName).toBe('Dana');
  });

  it('reports every invalid field with the app’s message keys', async () => {
    const customer = await signInCustomer(deps);
    const res = await request(app)
      .patch('/v1/customer/profile')
      .set(customer.headers)
      .send({
        firstName: '  ',
        lastName: 'x'.repeat(61),
        phone: '12',
        defaultLocation: { ...HOME, coordinates: { latitude: 95, longitude: 34 }, addressLine: '' },
        notificationPreferences: { pushEnabled: true },
        avatarUrl: '',
      })
      .expect(400);
    expect(res.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
      fieldErrors: {
        firstName: ['validation:profile.firstNameRequired'],
        lastName: ['validation:profile.nameTooLong'],
        phone: ['validation:profile.phoneInvalid'],
        'defaultLocation.coordinates': ['validation:location.coordinatesInvalid'],
        'defaultLocation.addressLine': ['validation:location.addressRequired'],
        'notificationPreferences.emailEnabled': ['validation:required'],
        'notificationPreferences.jobUpdates': ['validation:required'],
        'notificationPreferences.messages': ['validation:required'],
        'notificationPreferences.newRequests': ['validation:required'],
        'notificationPreferences.reminders': ['validation:required'],
        avatarUrl: ['validation:invalid'],
      },
    });
  });

  it('sets the avatar from the caller’s own upload and releases the old one', async () => {
    const customer = await signInCustomer(deps);
    const first = await createUpload(customer.user);
    const res = await request(app).patch('/v1/customer/profile').set(customer.headers).send({ avatarUrl: first.url, lastName: 'Mizrahi' }).expect(200);
    expect(res.body.user).toMatchObject({ avatarUrl: first.url, lastName: 'Mizrahi' });
    expect((await UserModel.findById(customer.user._id).lean())?.avatar).toEqual({ url: first.url, publicId: first.publicId });
    expect((await UploadModel.findById(first._id).lean())?.attachedAt).not.toBeNull();

    const removed = await request(app).patch('/v1/customer/profile').set(customer.headers).send({ avatarUrl: null }).expect(200);
    expect(removed.body.user.avatarUrl).toBeNull();
    expect((await UploadModel.findById(first._id).lean())?.attachedAt).toBeNull();
  });

  it('refuses avatars that are not the caller’s uploads and changes nothing', async () => {
    const customer = await signInCustomer(deps);
    const foreign = await createUpload(await createCustomer());
    for (const avatarUrl of [foreign.url, 'https://tracker.example/pixel.gif']) {
      const res = await request(app).patch('/v1/customer/profile').set(customer.headers).send({ avatarUrl, firstName: 'Changed' }).expect(400);
      expect(res.body.fieldErrors).toEqual({ avatarUrl: ['validation:invalid'] });
    }
    expect((await UserModel.findById(customer.user._id).lean())?.firstName).toBe(customer.user.firstName);
    expect((await UploadModel.findById(foreign._id).lean())?.attachedAt).toBeNull();
  });
});
