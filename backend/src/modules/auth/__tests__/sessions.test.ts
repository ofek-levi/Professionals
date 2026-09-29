import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { bearer } from '../../../../test/auth.js';
import type { AuthSession, RefreshResponse } from '../../../shared/contract/index.js';
import { DeviceModel } from '../../users/device.model.js';
import { SessionModel } from '../session.model.js';
import { customerPayload, registerAccount } from './auth-test-helpers.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe('sessions: refresh, reuse detection, logout', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(clearDatabase);

  const refresh = (refreshToken: string) => request(app).post('/v1/auth/refresh').send({ refreshToken });

  async function rotate(refreshToken: string): Promise<RefreshResponse> {
    const res = await refresh(refreshToken).expect(200);
    return res.body as RefreshResponse;
  }

  async function signUp(): Promise<AuthSession> {
    return registerAccount(app, customerPayload());
  }

  it('expires access tokens after 30 minutes and rotates the refresh token', async () => {
    const session = await signUp();
    deps.clock.advanceMinutes(31);
    const expired = await request(app).get('/v1/me').set(bearer(session.accessToken)).expect(401);
    expect(expired.body.code).toBe('UNAUTHORIZED');

    const next = await rotate(session.refreshToken);
    expect(next).toEqual({
      accessToken: expect.any(String),
      accessTokenExpiresAt: '2026-10-01T10:01:00.000Z',
      refreshToken: expect.any(String),
    });
    expect(next.refreshToken).not.toBe(session.refreshToken);
    await request(app).get('/v1/me').set(bearer(next.accessToken)).expect(200);
    // Same session, sliding 90-day expiry.
    const stored = await SessionModel.find().lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.expiresAt.toISOString()).toBe('2026-12-30T09:31:00.000Z');
  });

  it('revokes the whole session when a rotated-away token is replayed (theft)', async () => {
    const session = await signUp();
    const next = await rotate(session.refreshToken);
    deps.clock.advanceMinutes(5);

    const replay = await refresh(session.refreshToken).expect(401);
    expect(replay.body.code).toBe('UNAUTHORIZED');
    expect(await SessionModel.countDocuments()).toBe(0);
    // The legitimate holder of the newest token is signed out too, access token included.
    await refresh(next.refreshToken).expect(401);
    await request(app).get('/v1/me').set(bearer(next.accessToken)).expect(401);
  });

  it('does not treat a concurrent double refresh as theft', async () => {
    const session = await signUp();
    const next = await rotate(session.refreshToken);
    deps.clock.advance(10_000);
    await refresh(session.refreshToken).expect(401);
    expect(await SessionModel.countDocuments()).toBe(1);
    await rotate(next.refreshToken);
  });

  it('refuses unknown and expired refresh tokens and validates the payload', async () => {
    const session = await signUp();
    await refresh('not-a-token').expect(401);
    const invalid = await request(app).post('/v1/auth/refresh').send({}).expect(400);
    expect(invalid.body.fieldErrors).toEqual({ refreshToken: ['validation:required'] });

    deps.clock.advance(91 * DAY);
    await refresh(session.refreshToken).expect(401);
  });

  it('keeps a session alive as long as it is refreshed within 90 days', async () => {
    const session = await signUp();
    deps.clock.advance(80 * DAY);
    const second = await rotate(session.refreshToken);
    deps.clock.advance(80 * DAY);
    await rotate(second.refreshToken);
  });

  describe('POST /v1/auth/logout', () => {
    it('revokes the session of the refresh token and the devices it registered', async () => {
      const phone = await signUp();
      const tablet = await loginAgain(phone);
      await registerDevice(phone.accessToken, 'ExponentPushToken[phone]');
      await registerDevice(tablet.accessToken, 'ExponentPushToken[tablet]');

      const res = await request(app).post('/v1/auth/logout').send({ refreshToken: phone.refreshToken }).expect(200);
      expect(res.body).toEqual({ success: true });
      await refresh(phone.refreshToken).expect(401);
      await rotate(tablet.refreshToken);
      expect((await DeviceModel.find().lean()).map((device) => device.token)).toEqual(['ExponentPushToken[tablet]']);

      // Idempotent.
      await request(app).post('/v1/auth/logout').send({ refreshToken: phone.refreshToken }).expect(200);
    });

    it('stops the access tokens of the revoked session at once, not after 30 minutes', async () => {
      const phone = await signUp();
      const tablet = await loginAgain(phone);
      await request(app).post('/v1/auth/logout').send({ refreshToken: phone.refreshToken }).expect(200);

      const refused = await request(app).get('/v1/me').set(bearer(phone.accessToken)).expect(401);
      expect(refused.body.code).toBe('UNAUTHORIZED');
      await request(app).get('/v1/me').set(bearer(tablet.accessToken)).expect(200);
      // The denylist entry outlives the token and then goes away by itself.
      const [key] = await deps.redis.keys(deps.keys.key('revoked-sid', '*'));
      expect(await deps.redis.pttl(key ?? '')).toBeGreaterThan(29 * MINUTE);
    });

    it('uses the access token when no refresh token is sent (the current app)', async () => {
      const session = await signUp();
      await registerDevice(session.accessToken, 'ExponentPushToken[phone]');
      await request(app).post('/v1/auth/logout').set(bearer(session.accessToken)).expect(200);
      await refresh(session.refreshToken).expect(401);
      expect(await DeviceModel.countDocuments()).toBe(0);
      await request(app).get('/v1/me').set(bearer(session.accessToken)).expect(401);
    });

    it('succeeds without any credentials', async () => {
      await request(app).post('/v1/auth/logout').expect(200, { success: true });
      await request(app).post('/v1/auth/logout').set(bearer('garbage')).expect(200);
    });

    /** A second session of the same account (another device). */
    async function loginAgain(first: AuthSession): Promise<AuthSession> {
      const res = await request(app).post('/v1/auth/login').send({ email: first.user.email, password: 'Sunny-Garden-42' }).expect(200);
      return res.body as AuthSession;
    }

    async function registerDevice(accessToken: string, pushToken: string): Promise<void> {
      await request(app).post('/v1/me/devices').set(bearer(accessToken)).send({ pushToken, platform: 'ios' }).expect(200);
    }
  });
});
