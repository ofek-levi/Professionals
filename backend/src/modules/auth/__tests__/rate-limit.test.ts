import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { RATE_LIMITS } from '../../../middleware/rate-limit.js';
import { LOGIN_THROTTLE, recordLoginFailure } from '../login-throttle.js';
import { customerPayload, linkSentTo, registerAccount, STRONG_PASSWORD } from './auth-test-helpers.js';

/**
 * Rate limits on, and `X-Forwarded-For` trusted so each test can play several clients (in
 * development `TRUST_PROXY=true` is allowed; deployed environments must name their proxies).
 */
describe('auth rate limits cannot lock the owner out', () => {
  const { app, deps } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true', TRUST_PROXY: 'true' } });
  beforeEach(async () => {
    await clearDatabase();
    // Buckets outlive a test (their windows are real time): each test uses its own addresses and IPs.
  });

  let ipSequence = 0;
  const newIp = () => `203.0.113.${(ipSequence += 1)}`;
  const login = (ip: string, email: string, password: string) =>
    request(app).post('/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password });

  async function owner(email: string) {
    await registerAccount(app, customerPayload({ email }));
    return email;
  }

  it('a stranger’s failures from one IP never block the owner elsewhere', async () => {
    const email = await owner('target1@example.com');
    const attacker = newIp();
    for (let i = 0; i < LOGIN_THROTTLE.failuresPerAccountAndIp; i += 1) await login(attacker, email, 'Wrong-password-1').expect(401);
    const limited = await login(attacker, email.toUpperCase(), STRONG_PASSWORD).expect(429);
    expect(limited.body).toEqual({ code: 'RATE_LIMITED', message: expect.any(String) });

    const home = newIp();
    await login(home, email, 'Typo-password-2').expect(401);
    await login(home, email, STRONG_PASSWORD).expect(200);
  });

  it('only failures count: signing in successfully never uses the budget up', async () => {
    const email = await owner('target2@example.com');
    const ip = newIp();
    for (let i = 0; i < LOGIN_THROTTLE.failuresPerAccountAndIp + 5; i += 1) await login(ip, email, STRONG_PASSWORD).expect(200);
  });

  it('distributed guessing: the account-wide limit spares known IPs, and a password reset lifts it', async () => {
    const email = await owner('target3@example.com');
    const home = newIp();
    await login(home, email, STRONG_PASSWORD).expect(200);

    // 50 failures from 5 IPs (recorded directly: each HTTP attempt costs an argon2 check).
    for (let n = 0; n < LOGIN_THROTTLE.failuresPerAccount; n += 1) {
      await recordLoginFailure(deps, { email, ip: `ip:198.51.100.${n % 5}` });
    }
    await login(newIp(), email, STRONG_PASSWORD).expect(429);
    // The owner's usual IP still gets in.
    await login(home, email, STRONG_PASSWORD).expect(200);

    // From a new place the owner resets the password (proving the mailbox) and can sign in again.
    await request(app).post('/v1/auth/password-reset').set('X-Forwarded-For', newIp()).send({ email }).expect(200);
    const { token } = await linkSentTo(deps, email);
    await request(app).post('/v1/auth/reset-password').send({ token, password: 'Brand-New-Pass-7' }).expect(200);
    await login(newIp(), email, 'Brand-New-Pass-7').expect(200);
  });

  it('limits failed sign-ins per IP across accounts (password spraying)', async () => {
    const ip = newIp();
    for (let n = 0; n < LOGIN_THROTTLE.failuresPerIp; n += 1) await recordLoginFailure(deps, { email: `spray${n}@example.com`, ip: `ip:${ip}` });
    await login(ip, 'spray-next@example.com', 'Wrong-password-1').expect(429);
    await login(newIp(), 'spray-next@example.com', 'Wrong-password-1').expect(401);
  });

  it('reset requests for someone else’s address: same answer, capped emails, every link sent stays valid', async () => {
    const email = await owner('reset-target@example.com');
    const stranger = newIp();
    const sent: string[] = [];
    for (let i = 0; i < RATE_LIMITS.passwordResetEmailsPerAddress.limit + 2; i += 1) {
      await request(app).post('/v1/auth/password-reset').set('X-Forwarded-For', stranger).send({ email }).expect(200, { success: true });
      await deps.background.drain();
      const { token } = await linkSentTo(deps, email);
      if (!sent.includes(token)) sent.push(token);
    }
    expect(sent).toHaveLength(RATE_LIMITS.passwordResetEmailsPerAddress.limit);
    // The owner uses the FIRST link, although newer ones were sent after it.
    await request(app).post('/v1/auth/reset-password').send({ token: sent[0], password: 'Brand-New-Pass-7' }).expect(200);
    // A successful reset ends the other links.
    await request(app).post('/v1/auth/reset-password').send({ token: sent[1], password: 'Other-New-Pass-8' }).expect(400);
  });

  it('limits refreshes per session, not per IP', async () => {
    const session = await registerAccount(app, customerPayload({ email: 'refresher@example.com' }));
    const ip = newIp();
    let token = session.refreshToken;
    for (let i = 0; i < RATE_LIMITS.refreshPerSession.limit; i += 1) {
      const res = await request(app).post('/v1/auth/refresh').set('X-Forwarded-For', ip).send({ refreshToken: token }).expect(200);
      token = (res.body as { refreshToken: string }).refreshToken;
    }
    await request(app).post('/v1/auth/refresh').set('X-Forwarded-For', ip).send({ refreshToken: token }).expect(429);
    // Another user behind the same IP is not affected.
    const other = await registerAccount(app, customerPayload({ email: 'neighbour@example.com' }));
    await request(app).post('/v1/auth/refresh').set('X-Forwarded-For', ip).send({ refreshToken: other.refreshToken }).expect(200);
  });
});
