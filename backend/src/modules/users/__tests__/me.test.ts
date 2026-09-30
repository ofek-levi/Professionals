import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createRequest } from '../../../../test/factories.js';
import { ProfessionalModel } from '../../professionals/professional.model.js';
import { UserModel } from '../user.model.js';

describe('/v1/me', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(clearDatabase);

  it('returns a customer with the customer profile and its counts', async () => {
    const customer = await signInCustomer(deps, { firstName: 'Noa', lastName: 'Levi', language: 'he' });
    const pro = await signInProfessional(deps);
    await createRequest(customer.user, { status: 'draft' });
    const request1 = await createRequest(customer.user);
    const offer = await createOffer(request1, pro.professional);
    await createJob(request1, offer, { status: 'completed' });

    const res = await request(app).get('/v1/me').set(customer.headers).expect(200);
    expect(res.body).toEqual({
      user: {
        id: customer.user._id.toHexString(),
        role: 'customer',
        firstName: 'Noa',
        lastName: 'Levi',
        displayName: 'Noa Levi',
        email: customer.user.email,
        phone: customer.user.phone,
        avatarUrl: null,
        preferredLanguage: 'he',
        createdAt: '2026-10-01T09:00:00.000Z',
      },
      emailVerified: false,
      customerProfile: {
        userId: customer.user._id.toHexString(),
        defaultLocation: expect.objectContaining({ city: 'Tel Aviv-Yafo', isApproximate: false }),
        savedLocations: [],
        notificationPreferences: expect.objectContaining({ pushEnabled: true }),
        stats: { requestsCount: 1, completedJobsCount: 1 },
        updatedAt: '2026-10-01T09:00:00.000Z',
      },
      professionalProfile: null,
    });
  });

  it('returns a professional with the complete own profile', async () => {
    const pro = await signInProfessional(deps, { professional: { displayName: 'Avi Fix Ltd' } });
    const res = await request(app).get('/v1/me').set(pro.headers).expect(200);
    expect(res.body.user).toMatchObject({ role: 'professional', displayName: 'Avi Fix Ltd' });
    expect(res.body.emailVerified).toBe(false);
    expect(res.body.customerProfile).toBeNull();
    await UserModel.updateOne({ _id: pro.user._id }, { $set: { emailVerifiedAt: deps.clock.now() } });
    expect((await request(app).get('/v1/me').set(pro.headers).expect(200)).body.emailVerified).toBe(true);
    expect(res.body.professionalProfile).toMatchObject({
      id: pro.user._id.toHexString(),
      displayName: 'Avi Fix Ltd',
      contact: expect.objectContaining({ phone: '052-765-4321' }),
      baseLocation: expect.objectContaining({ isApproximate: false }),
      notificationPreferences: expect.objectContaining({ newRequests: true }),
    });
  });

  it('requires a valid access token and a live account', async () => {
    await request(app).get('/v1/me').expect(401);
    const customer = await signInCustomer(deps);
    await UserModel.deleteOne({ _id: customer.user._id });
    const gone = await request(app).get('/v1/me').set(customer.headers).expect(401);
    expect(gone.body.code).toBe('UNAUTHORIZED');

    const pro = await signInProfessional(deps);
    await ProfessionalModel.deleteOne({ _id: pro.user._id });
    await request(app).get('/v1/me').set(pro.headers).expect(404);
  });

  it('PATCH changes the language of notifications and emails', async () => {
    const customer = await signInCustomer(deps, { language: 'en' });
    const res = await request(app).patch('/v1/me').set(customer.headers).send({ preferredLanguage: 'he' }).expect(200);
    expect(res.body.user.preferredLanguage).toBe('he');
    expect((await UserModel.findById(customer.user._id, { language: 1 }).lean())?.language).toBe('he');

    const invalid = await request(app).patch('/v1/me').set(customer.headers).send({ preferredLanguage: 'fr' }).expect(400);
    expect(invalid.body.fieldErrors).toEqual({ preferredLanguage: ['validation:invalid'] });
  });
});
