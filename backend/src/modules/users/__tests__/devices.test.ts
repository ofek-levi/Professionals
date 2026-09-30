import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { accessTokenFor, bearer, signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { verifyAccessToken } from '../../../lib/access-token.js';
import { DeviceModel } from '../device.model.js';

const TOKEN = 'ExponentPushToken[abc123]';

describe('/v1/me/devices', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('registers a device for the caller’s session (idempotent)', async () => {
    const customer = await signInCustomer(deps);
    for (let i = 0; i < 2; i += 1) {
      await request(app).post('/v1/me/devices').set(customer.headers).send({ pushToken: TOKEN, platform: 'ios' }).expect(200, { success: true });
    }
    const devices = await DeviceModel.find().lean();
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ user: customer.user._id, token: TOKEN });
    expect(devices[0]).not.toHaveProperty('platform'); // validated, never read, so not stored
    expect(devices[0]?.session.toHexString()).toBe(verifyAccessToken(deps.env.jwt, customer.token, deps.clock)?.sessionId);
  });

  it('moves a token to the account that registers it last (shared phone)', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps);
    await request(app).post('/v1/me/devices').set(customer.headers).send({ pushToken: TOKEN, platform: 'android' }).expect(200);
    await request(app).post('/v1/me/devices').set(pro.headers).send({ pushToken: TOKEN, platform: 'android' }).expect(200);
    expect(await DeviceModel.find({}, { user: 1 }).lean()).toEqual([expect.objectContaining({ user: pro.user._id })]);
  });

  it('handles concurrent registrations of a new token', async () => {
    const customer = await signInCustomer(deps);
    const results = await Promise.all(
      [1, 2, 3].map(() => request(app).post('/v1/me/devices').set(customer.headers).send({ pushToken: TOKEN, platform: 'ios' })),
    );
    expect(results.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(await DeviceModel.countDocuments()).toBe(1);
  });

  it('validates the payload and refuses tokens Expo cannot deliver to', async () => {
    const customer = await signInCustomer(deps);
    const empty = await request(app).post('/v1/me/devices').set(customer.headers).send({ pushToken: ' ', platform: 'desktop' }).expect(400);
    expect(empty.body.fieldErrors).toEqual({ pushToken: ['validation:required'], platform: ['validation:invalid'] });
    const fake = await request(app).post('/v1/me/devices').set(customer.headers).send({ pushToken: 'simulated:push_1', platform: 'web' }).expect(400);
    expect(fake.body.fieldErrors).toEqual({ pushToken: ['validation:invalid'] });
    await request(app).post('/v1/me/devices').send({ pushToken: TOKEN, platform: 'ios' }).expect(401);
  });

  it('DELETE removes only the caller’s own device', async () => {
    const customer = await signInCustomer(deps);
    const other = await signInCustomer(deps);
    await request(app).post('/v1/me/devices').set(customer.headers).send({ pushToken: TOKEN, platform: 'ios' }).expect(200);

    const path = `/v1/me/devices/${encodeURIComponent(TOKEN)}`;
    await request(app).delete(path).set(other.headers).expect(200, { success: true });
    expect(await DeviceModel.countDocuments()).toBe(1);
    await request(app).delete(path).set(customer.headers).expect(200, { success: true });
    expect(await DeviceModel.countDocuments()).toBe(0);
    await request(app).delete(path).set(bearer(accessTokenFor(deps, customer.user))).expect(200);
  });
});
