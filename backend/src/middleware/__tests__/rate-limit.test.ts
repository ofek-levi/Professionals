import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../test/app.js';
import { createSilentLogger } from '../../lib/logger.js';
import { errorHandler } from '../error-handler.js';
import { emailKey, rateLimit } from '../rate-limit.js';

function appWith(deps: ReturnType<typeof createTestDeps>) {
  const app = express();
  app.use(express.json());
  app.post('/login', rateLimit(deps, 'test-login-ip', { windowMs: 60_000, limit: 3 }), (_req, res) => res.json({ ok: true }));
  app.post('/reset', rateLimit(deps, 'test-reset-email', { windowMs: 60_000, limit: 2, key: emailKey }), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler(createSilentLogger()));
  return app;
}

describe('rateLimit (Redis store)', () => {
  it('answers 429 RATE_LIMITED past the limit, with standard headers', async () => {
    const app = appWith(createTestDeps({ env: { RATE_LIMIT_ENABLED: 'true' } }));
    for (let i = 0; i < 3; i += 1) await request(app).post('/login').expect(200);
    const res = await request(app).post('/login').expect(429);
    expect(res.body).toEqual({ code: 'RATE_LIMITED', message: 'Too many requests, please try again later' });
    expect(res.headers.ratelimit).toBeDefined();
  });

  it('counts per email (case-insensitive) and skips requests without one', async () => {
    const app = appWith(createTestDeps({ env: { RATE_LIMIT_ENABLED: 'true' } }));
    await request(app).post('/reset').send({ email: 'A@example.com' }).expect(200);
    await request(app).post('/reset').send({ email: 'a@example.com' }).expect(200);
    await request(app).post('/reset').send({ email: 'a@example.com ' }).expect(429);
    await request(app).post('/reset').send({ email: 'b@example.com' }).expect(200);
    for (let i = 0; i < 4; i += 1) await request(app).post('/reset').send({}).expect(200);
  });

  it('is a no-op when disabled', async () => {
    const app = appWith(createTestDeps());
    for (let i = 0; i < 5; i += 1) await request(app).post('/login').expect(200);
  });
});
