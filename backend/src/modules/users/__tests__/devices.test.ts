import type { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { accessTokenFor, bearer, signInCustomer } from '../../../../test/auth.js';
import { createCustomer, createProfessional, createPushSession, createSession } from '../../../../test/factories.js';
import { on, profiled } from '../../../../test/query-profile.js';
import { forgetPushTokens, pushTargetsOf } from '../../auth/push-token.service.js';
import { SessionModel } from '../../auth/session.model.js';
import type { UserDoc } from '../user.model.js';

const TOKEN = 'ExponentPushToken[abc123]';

describe('/v1/me/devices', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  /** A signed-in app install: a stored session of `user` and headers with an access token for it. */
  async function signInApp(user: Pick<UserDoc, '_id' | 'role'>) {
    const session = await createSession(user);
    return { user, session, headers: bearer(accessTokenFor(deps, user, session._id)) };
  }
  const register = (headers: Record<string, string>, pushToken = TOKEN) => request(app).post('/v1/me/devices').set(headers).send({ pushToken, platform: 'ios' });
  const unregister = (headers: Record<string, string>, pushToken = TOKEN) => request(app).delete(`/v1/me/devices/${encodeURIComponent(pushToken)}`).set(headers);
  const tokenOf = async (sessionId: Types.ObjectId) => (await SessionModel.findById(sessionId, { pushToken: 1 }).lean())?.pushToken;
  const holders = async (pushToken = TOKEN) => (await SessionModel.find({ pushToken }, { _id: 1 }).lean()).map((found) => found._id.toHexString());

  it('stores the token on the caller’s session (idempotent)', async () => {
    const phone = await signInApp(await createCustomer());
    const tablet = await signInApp(phone.user);
    for (let i = 0; i < 2; i += 1) await register(phone.headers).expect(200, { success: true });
    expect(await holders()).toEqual([phone.session._id.toHexString()]);
    expect(await tokenOf(tablet.session._id)).toBeUndefined();
    // The platform is validated but never read, so it is not stored.
    expect(await SessionModel.findById(phone.session._id).lean()).not.toHaveProperty('platform');
  });

  it('replaces the install’s previous token when the OS rotates it', async () => {
    const phone = await signInApp(await createCustomer());
    await register(phone.headers).expect(200);
    await register(phone.headers, 'ExponentPushToken[rotated]').expect(200);
    expect(await tokenOf(phone.session._id)).toBe('ExponentPushToken[rotated]');
    expect(await holders()).toEqual([]);
  });

  it('moves a token to the account that registers it last (shared phone)', async () => {
    const customer = await signInApp(await createCustomer());
    const pro = await signInApp((await createProfessional()).user);
    await register(customer.headers).expect(200);
    await register(pro.headers).expect(200);
    expect(await holders()).toEqual([pro.session._id.toHexString()]);
    expect(await SessionModel.countDocuments()).toBe(2); // the customer's session itself stays
  });

  it('handles concurrent registrations, also of one token by several sessions (one of them keeps it)', async () => {
    const phone = await signInApp(await createCustomer());
    const repeated = await Promise.all([1, 2, 3].map(() => register(phone.headers)));
    expect(repeated.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(await holders()).toEqual([phone.session._id.toHexString()]);

    const installs = [phone, await signInApp(await createCustomer()), await signInApp(await createCustomer())];
    const racing = await Promise.all(installs.map((install) => register(install.headers, 'ExponentPushToken[shared]')));
    expect(racing.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(await holders('ExponentPushToken[shared]')).toHaveLength(1);
  });

  it('validates the payload, refuses tokens Expo cannot deliver to and callers without a live session', async () => {
    const phone = await signInApp(await createCustomer());
    const empty = await request(app).post('/v1/me/devices').set(phone.headers).send({ pushToken: ' ', platform: 'desktop' }).expect(400);
    expect(empty.body.fieldErrors).toEqual({ pushToken: ['validation:required'], platform: ['validation:invalid'] });
    const fake = await register(phone.headers, 'simulated:push_1').expect(400);
    expect(fake.body.fieldErrors).toEqual({ pushToken: ['validation:invalid'] });
    await request(app).post('/v1/me/devices').send({ pushToken: TOKEN, platform: 'ios' }).expect(401);
    // A token whose session is gone (signed out meanwhile) cannot register: nothing would ever push to it.
    const ended = await signInCustomer(deps);
    expect((await register(ended.headers).expect(401)).body.code).toBe('UNAUTHORIZED');
    expect(await SessionModel.countDocuments({ pushToken: { $exists: true } })).toBe(0);
  });

  it('DELETE clears the token only from the caller’s own sessions (idempotent)', async () => {
    const phone = await signInApp(await createCustomer());
    const other = await signInApp(await createCustomer());
    await register(phone.headers).expect(200);

    await unregister(other.headers).expect(200, { success: true });
    expect(await tokenOf(phone.session._id)).toBe(TOKEN);
    // Any session of the owner may remove it (e.g. the app turning push off after a token refresh).
    await unregister(bearer(accessTokenFor(deps, phone.user))).expect(200, { success: true });
    expect(await tokenOf(phone.session._id)).toBeUndefined();
    await unregister(phone.headers).expect(200, { success: true });
    expect(await SessionModel.countDocuments()).toBe(2); // sessions stay signed in
  });

  it('serves every push-token query from an index', async () => {
    const customer = await createCustomer();
    const phone = await signInApp(customer);
    await createPushSession(customer);
    await createPushSession(customer);
    // Sessions of other accounts, with and without a token, that no query may scan.
    for (let i = 0; i < 20; i += 1) {
      const other = await createCustomer();
      await (i % 2 === 0 ? createPushSession(other) : createSession(other));
    }
    const ops = await profiled(async () => {
      await register(phone.headers).expect(200);
      await pushTargetsOf([customer._id], deps.clock.now());
      await forgetPushTokens([TOKEN, 'ExponentPushToken[unknown]']);
      await unregister(phone.headers).expect(200);
    });
    const sessionOps = on(ops, 'sessions');
    expect(sessionOps.map((op) => op.op)).toEqual(['update', 'update', 'query', 'update', 'update']);
    for (const op of sessionOps) {
      expect(op.planSummary, JSON.stringify(op.command)).toMatch(/IXSCAN|IDHACK/);
      expect(op.planSummary).not.toMatch(/COLLSCAN/);
      expect(op.keysExamined ?? 0, JSON.stringify(op.command)).toBeLessThanOrEqual(4);
    }
  });
});
