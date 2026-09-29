import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createCustomer, createJob, createOffer, createProfessional, createRequest } from '../../../../test/factories.js';
import { KEY_SPACES } from '../../../infra/keys.js';
import { haversineDistanceKm } from '../../../lib/geo.js';
import { newObjectId } from '../../../lib/ids.js';
import { ProfessionalModel } from '../professional.model.js';
import { invalidatePublicProfessionalProfile } from '../professional-cache.js';

describe('GET /v1/professionals/:id', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    const keys = await deps.redis.keys(deps.keys.key(KEY_SPACES.cache, 'professional:*'));
    if (keys.length > 0) await deps.redis.del(...keys);
  });

  it('shows strangers an approximate base and no contact or settings', async () => {
    const { professional } = await createProfessional({ user: { avatar: { url: 'https://img.test/a.jpg', publicId: 'a' } } });
    const customer = await signInCustomer(deps);
    const res = await request(app).get(`/v1/professionals/${professional._id.toHexString()}`).set(customer.headers).expect(200);

    expect(res.body).toMatchObject({ id: professional._id.toHexString(), avatarUrl: 'https://img.test/a.jpg', contact: null });
    expect(res.body).not.toHaveProperty('notificationPreferences');
    expect(res.body.baseLocation).toMatchObject({ addressLine: '', details: null, isApproximate: true, city: 'Tel Aviv-Yafo' });
    const shift = haversineDistanceKm({ latitude: 32.0853, longitude: 34.7818 }, res.body.serviceArea.center);
    expect(shift).toBeGreaterThan(0.2);
    expect(shift).toBeLessThan(0.5);

    const otherPro = await signInProfessional(deps);
    const asPro = await request(app).get(`/v1/professionals/${professional._id.toHexString()}`).set(otherPro.headers).expect(200);
    expect(asPro.body).toEqual(res.body);
  });

  it('shows the contact to customers who hired the professional', async () => {
    const { professional } = await createProfessional();
    const customer = await signInCustomer(deps);
    const req = await createRequest(customer.user);
    await createJob(req, await createOffer(req, professional), { status: 'cancelled' });

    const res = await request(app).get(`/v1/professionals/${professional._id.toHexString()}`).set(customer.headers).expect(200);
    expect(res.body.contact).toEqual(professional.contact);
    expect(res.body.baseLocation.isApproximate).toBe(true);
    // The shared cache never holds the contact.
    const cached = await deps.cache.get<{ contact: unknown }>(`professional:public:${professional._id.toHexString()}`);
    expect(cached?.contact).toBeNull();
  });

  it('shows the owner the exact profile without the private settings', async () => {
    const pro = await signInProfessional(deps);
    const res = await request(app).get(`/v1/professionals/${pro.user._id.toHexString()}`).set(pro.headers).expect(200);
    expect(res.body).toMatchObject({ contact: pro.professional.contact, baseLocation: { addressLine: 'Ibn Gabirol St 50', isApproximate: false } });
    expect(res.body).not.toHaveProperty('notificationPreferences');
  });

  it('answers 404 for unknown, malformed and non-professional ids and 401 without a session', async () => {
    const customer = await signInCustomer(deps);
    const other = await createCustomer();
    for (const id of [newObjectId().toHexString(), 'not-an-id', other._id.toHexString()]) {
      const res = await request(app).get(`/v1/professionals/${id}`).set(customer.headers).expect(404);
      expect(res.body.code).toBe('NOT_FOUND');
    }
    await request(app).get(`/v1/professionals/${newObjectId().toHexString()}`).expect(401);
  });

  it('caches the public view briefly and drops it when the profile changes', async () => {
    const pro = await signInProfessional(deps);
    const customer = await signInCustomer(deps);
    const url = `/v1/professionals/${pro.user._id.toHexString()}`;
    await request(app).get(url).set(customer.headers).expect(200);
    const key = deps.keys.key(KEY_SPACES.cache, `professional:public:${pro.user._id.toHexString()}`);
    const ttl = await deps.redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    // Served from the cache: a direct write is not visible until invalidated.
    await ProfessionalModel.updateOne({ _id: pro.user._id }, { $set: { headline: 'Changed behind the cache' } });
    expect((await request(app).get(url).set(customer.headers).expect(200)).body.headline).toBe(pro.professional.headline);
    await invalidatePublicProfessionalProfile(deps, pro.user._id);
    expect((await request(app).get(url).set(customer.headers).expect(200)).body.headline).toBe('Changed behind the cache');

    // A profile PATCH invalidates it.
    await request(app).patch('/v1/professional/profile').set(pro.headers).send({ headline: 'Fresh headline' }).expect(200);
    expect((await request(app).get(url).set(customer.headers).expect(200)).body.headline).toBe('Fresh headline');
  });
});
