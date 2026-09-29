import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { bearer } from '../../../../test/auth.js';
import { createCustomer, createDevice } from '../../../../test/factories.js';
import { UnconfiguredGoogleVerifier } from '../../../infra/google/google-verifier.js';
import type { AuthSession } from '../../../shared/contract/index.js';
import { DeviceModel } from '../../users/device.model.js';
import { UserModel } from '../../users/user.model.js';
import { SessionModel } from '../session.model.js';
import { customerPayload, loginAccount, registerAccount, STRONG_PASSWORD } from './auth-test-helpers.js';

describe('POST /v1/auth/google', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(clearDatabase);

  const google = (idToken: string) => request(app).post('/v1/auth/google').send({ idToken });

  it('asks an unknown Google identity to finish the sign-up', async () => {
    const idToken = deps.google.issue({ email: 'dana@example.com', firstName: 'Dana', lastName: 'Mizrahi', avatarUrl: 'https://lh3.test/d.jpg' });
    const res = await google(idToken).expect(200);
    expect(res.body).toEqual({
      status: 'registration_required',
      profile: { email: 'dana@example.com', firstName: 'Dana', lastName: 'Mizrahi', avatarUrl: 'https://lh3.test/d.jpg' },
    });
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('signs a linked account in by Google id, even after its address changed at Google', async () => {
    const user = await createCustomer({ email: 'old@example.com', googleSub: 'google-dana' });
    const res = await google(deps.google.issue({ email: 'new@example.com', sub: 'google-dana' })).expect(200);
    expect(res.body).toMatchObject({ status: 'signed_in', session: { refreshToken: expect.any(String), user: { id: user._id.toHexString() } } });
    const session = (res.body as { session: AuthSession }).session;
    await request(app).get('/v1/me').set(bearer(session.accessToken)).expect(200);
  });

  it('refuses an address linked to a different Google account', async () => {
    await createCustomer({ email: 'dana@example.com', googleSub: 'google-original' });
    const res = await google(deps.google.issue({ email: 'dana@example.com', sub: 'google-recycled' })).expect(401);
    expect(res.body.code).toBe('INVALID_GOOGLE_TOKEN');
  });

  it('links a verified password account and keeps its password and sessions', async () => {
    const existing = await registerAccount(app, customerPayload({ email: 'verified@example.com' }));
    await UserModel.updateOne({ _id: existing.user.id }, { $set: { emailVerifiedAt: deps.clock.now() } });

    const res = await google(deps.google.issue({ email: 'verified@example.com', sub: 'google-v' })).expect(200);
    expect(res.body.status).toBe('signed_in');
    const user = await UserModel.findById(existing.user.id).lean();
    expect(user?.googleSub).toBe('google-v');
    expect(user?.passwordHash).toEqual(expect.any(String));
    await loginAccount(app, 'verified@example.com');
    await request(app).post('/v1/auth/refresh').send({ refreshToken: existing.refreshToken }).expect(200);
  });

  it('pre-account hijacking: drops an unverified password and revokes every session', async () => {
    // Someone registered the address first and chose the password; the owner then uses Google.
    const squatter = await registerAccount(app, customerPayload({ email: 'owner@example.com' }));
    await createDevice({ _id: await idOf('owner@example.com') }, { token: 'ExponentPushToken[squatter]' });

    const res = await google(deps.google.issue({ email: 'owner@example.com', sub: 'google-owner' })).expect(200);
    expect(res.body.status).toBe('signed_in');

    const user = await UserModel.findById(squatter.user.id).lean();
    expect(user).toMatchObject({ googleSub: 'google-owner', emailVerifiedAt: new Date('2026-10-01T09:00:00.000Z') });
    expect(user?.passwordHash).toBeUndefined();
    await request(app).post('/v1/auth/login').send({ email: 'owner@example.com', password: STRONG_PASSWORD }).expect(401);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: squatter.refreshToken }).expect(401);
    await request(app).get('/v1/me').set(bearer(squatter.accessToken)).expect(401);
    expect(await DeviceModel.countDocuments()).toBe(0);
    // Only the owner's new session remains, and it works.
    expect(await SessionModel.countDocuments()).toBe(1);
    const owner = (res.body as { session: AuthSession }).session;
    await request(app).post('/v1/auth/refresh').send({ refreshToken: owner.refreshToken }).expect(200);
    await request(app).get('/v1/me').set(bearer(owner.accessToken)).expect(200);
  });

  it('answers 401 INVALID_GOOGLE_TOKEN for an unverifiable token and 400 without one', async () => {
    const invalid = await google('forged-token').expect(401);
    expect(invalid.body).toEqual({ code: 'INVALID_GOOGLE_TOKEN', message: expect.any(String) });
    const missing = await request(app).post('/v1/auth/google').send({}).expect(400);
    expect(missing.body.fieldErrors).toEqual({ idToken: ['validation:auth.googleSignInRequired'] });
  });

  it('answers 503 when Google sign-in is not configured', async () => {
    // Same clock, so the model clock of this file stays the one of the main app.
    const unconfigured = createTestApp({ deps: { clock: deps.clock, google: new UnconfiguredGoogleVerifier() } });
    const res = await request(unconfigured.app).post('/v1/auth/google').send({ idToken: 'anything' }).expect(503);
    expect(res.body.code).toBe('SERVER_ERROR');
  });
});

async function idOf(email: string) {
  const user = await UserModel.findOne({ email }, { _id: 1 }).lean();
  if (!user) throw new Error(`no user ${email}`);
  return user._id;
}
