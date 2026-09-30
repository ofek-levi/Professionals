import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { bearer } from '../../../../test/auth.js';
import { newObjectId } from '../../../lib/ids.js';
import type { AuthSession, RefreshResponse } from '../../../shared/contract/index.js';
import { createNotification } from '../../notifications/create-notification.service.js';
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
    // The owner keeps refreshing; a copy of the first token shows up later.
    const newest = await rotate(next.refreshToken);

    const replay = await refresh(session.refreshToken).expect(401);
    expect(replay.body.code).toBe('UNAUTHORIZED');
    expect(await SessionModel.countDocuments()).toBe(0);
    // The legitimate holder of the newest token is signed out too, access token included.
    await refresh(newest.refreshToken).expect(401);
    await request(app).get('/v1/me').set(bearer(newest.accessToken)).expect(401);
  });

  it('revokes the session when a token older than the previous one is replayed (thief rotated twice)', async () => {
    const session = await signUp();
    // The thief refreshes the stolen token twice, so the owner's token is two rotations old.
    const first = await rotate(session.refreshToken);
    const second = await rotate(first.refreshToken);
    deps.clock.advanceMinutes(5);

    await refresh(session.refreshToken).expect(401);
    expect(await SessionModel.countDocuments()).toBe(0);
    await refresh(second.refreshToken).expect(401);
    await request(app).get('/v1/me').set(bearer(second.accessToken)).expect(401);
  });

  it('revokes on an old token even inside the grace window of the latest rotation', async () => {
    const session = await signUp();
    const first = await rotate(session.refreshToken);
    await rotate(first.refreshToken);
    await refresh(session.refreshToken).expect(401);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('gives concurrent refreshes with the same token the same successor (no fork, no revocation)', async () => {
    const session = await signUp();
    const results = await Promise.all(Array.from({ length: 5 }, () => refresh(session.refreshToken)));
    expect(results.map((res) => res.status)).toEqual([200, 200, 200, 200, 200]);
    const tokens = new Set(results.map((res) => (res.body as RefreshResponse).refreshToken));
    expect(tokens.size).toBe(1);
    expect(await SessionModel.countDocuments()).toBe(1);
    const [next] = [...tokens];
    await rotate(next ?? '');
  });

  it('answers a retry after a lost response while its successor is unused, up to an access token lifetime', async () => {
    const session = await signUp();
    const lost = await rotate(session.refreshToken);
    deps.clock.advance(10_000);
    const retried = await rotate(session.refreshToken);
    expect(retried.refreshToken).toBe(lost.refreshToken);
    await request(app).get('/v1/me').set(bearer(retried.accessToken)).expect(200);

    // Offline for 20 minutes after the lost response (the finding: 31 s used to revoke the session).
    deps.clock.advanceMinutes(20);
    const later = await rotate(session.refreshToken);
    expect(later.refreshToken).toBe(lost.refreshToken);
    expect(await SessionModel.countDocuments()).toBe(1);
    // The never-used successor still works.
    await rotate(lost.refreshToken);
  });

  it('treats a replay as theft once the successor was used, or after an access token lifetime', async () => {
    const used = await signUp();
    const next = await rotate(used.refreshToken);
    await rotate(next.refreshToken);
    await refresh(used.refreshToken).expect(401);
    expect(await SessionModel.countDocuments()).toBe(0);

    const stale = await signUp();
    await rotate(stale.refreshToken);
    deps.clock.advanceMinutes(31);
    await refresh(stale.refreshToken).expect(401);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('refuses a forged token naming a live session without revoking it', async () => {
    const session = await signUp();
    expect(session.refreshToken).toMatch(/^[0-9a-f]{24}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{22}$/);
    const [sessionId] = session.refreshToken.split('.');
    const forged = `${sessionId}.${'A'.repeat(43)}.${'B'.repeat(22)}`;
    await refresh(forged).expect(401);
    await request(app).post('/v1/auth/logout').send({ refreshToken: forged }).expect(200);
    expect(await SessionModel.countDocuments()).toBe(1);
    await rotate(session.refreshToken);
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
    it('revokes the session of the refresh token, and with it the push token it registered', async () => {
      const phone = await signUp();
      const tablet = await loginAgain(phone);
      await registerDevice(phone.accessToken, 'ExponentPushToken[phone]');
      await registerDevice(tablet.accessToken, 'ExponentPushToken[tablet]');

      const res = await request(app).post('/v1/auth/logout').send({ refreshToken: phone.refreshToken }).expect(200);
      expect(res.body).toEqual({ success: true });
      await refresh(phone.refreshToken).expect(401);
      await rotate(tablet.refreshToken); // a refresh keeps the install's push token
      expect(await pushTokens()).toEqual(['ExponentPushToken[tablet]']);

      // The signed-out phone gets no more pushes; the tablet still does.
      deps.push.sent.length = 0;
      await createNotification(deps, idOf(phone), {
        type: 'new_message',
        conversationId: newObjectId(),
        categoryId: 'plumbing',
        senderRole: 'professional',
        senderName: 'Avi Fix',
        messageText: 'On my way',
        replacesUnread: true,
      });
      await deps.background.drain();
      expect(deps.push.sent.map((message) => message.to)).toEqual(['ExponentPushToken[tablet]']);

      // Idempotent.
      await request(app).post('/v1/auth/logout').send({ refreshToken: phone.refreshToken }).expect(200);
    });

    it('accepts any token this server issued for the session, however old', async () => {
      const session = await signUp();
      const first = await rotate(session.refreshToken);
      await rotate(first.refreshToken);
      await request(app).post('/v1/auth/logout').send({ refreshToken: session.refreshToken }).expect(200);
      expect(await SessionModel.countDocuments()).toBe(0);
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
      expect(await pushTokens()).toEqual([]);
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

    async function pushTokens(): Promise<(string | undefined)[]> {
      return (await SessionModel.find({ pushToken: { $exists: true } }, { pushToken: 1 }).lean()).map((session) => session.pushToken);
    }

    const idOf = (session: AuthSession) => new Types.ObjectId(session.user.id);
  });
});
