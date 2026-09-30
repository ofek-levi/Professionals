import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestApp, createTestDeps } from '../../../test/app.js';
import { signInCustomer } from '../../../test/auth.js';
import { createSilentLogger } from '../../lib/logger.js';
import { errorHandler } from '../error-handler.js';
import { emailAndIpKey, principalKey, rateLimit } from '../rate-limit.js';

function appWith(deps: ReturnType<typeof createTestDeps>) {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.post('/login', rateLimit(deps, 'test-login-ip', { windowMs: 60_000, limit: 3 }), (_req, res) => res.json({ ok: true }));
  app.post('/register', rateLimit(deps, 'test-register-email', { windowMs: 60_000, limit: 2, key: emailAndIpKey }), (_req, res) => res.json({ ok: true }));
  app.get('/any', rateLimit(deps, 'test-global', { windowMs: 60_000, limit: 3, key: principalKey(deps) }), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler(createSilentLogger()));
  return app;
}

describe('rateLimit (Redis store)', () => {
  // Creates the model clock the factories use.
  createTestApp();

  it('answers 429 RATE_LIMITED past the limit, with standard headers', async () => {
    const app = appWith(createTestDeps({ env: { RATE_LIMIT_ENABLED: 'true' } }));
    for (let i = 0; i < 3; i += 1) await request(app).post('/login').set('X-Forwarded-For', '192.0.2.1').expect(200);
    const res = await request(app).post('/login').set('X-Forwarded-For', '192.0.2.1').expect(429);
    expect(res.body).toEqual({ code: 'RATE_LIMITED', message: 'Too many requests, please try again later' });
    expect(res.headers.ratelimit).toBeDefined();
  });

  it('counts per (email, IP): the same address from another IP has its own budget', async () => {
    const app = appWith(createTestDeps({ env: { RATE_LIMIT_ENABLED: 'true' } }));
    const post = (email: string | undefined, ip: string) => request(app).post('/register').set('X-Forwarded-For', ip).send(email ? { email } : {});
    await post('A@example.com', '192.0.2.10').expect(200);
    await post('a@example.com ', '192.0.2.10').expect(200);
    await post('a@example.com', '192.0.2.10').expect(429);
    await post('a@example.com', '192.0.2.11').expect(200);
    for (let i = 0; i < 4; i += 1) await post(undefined, '192.0.2.10').expect(200);
  });

  it('keys signed-in traffic by user: users behind one IP (CGNAT) do not share a bucket', async () => {
    const deps = createTestDeps({ env: { RATE_LIMIT_ENABLED: 'true' } });
    const app = appWith(deps);
    const ip = '192.0.2.20';
    const [first, second] = [await signInCustomer(deps), await signInCustomer(deps)];
    for (let i = 0; i < 3; i += 1) await request(app).get('/any').set('X-Forwarded-For', ip).set(first.headers).expect(200);
    await request(app).get('/any').set('X-Forwarded-For', ip).set(first.headers).expect(429);
    await request(app).get('/any').set('X-Forwarded-For', ip).set(second.headers).expect(200);
    // Anonymous (or forged-token) traffic from that IP has the IP's own bucket.
    await request(app).get('/any').set('X-Forwarded-For', ip).set({ Authorization: 'Bearer forged' }).expect(200);
  });

  it('is a no-op when disabled', async () => {
    const app = appWith(createTestDeps());
    for (let i = 0; i < 5; i += 1) await request(app).post('/login').expect(200);
  });
});
