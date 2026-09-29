import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestApp } from '../../../../test/app.js';
import { RATE_LIMITS } from '../../../middleware/rate-limit.js';

describe('auth rate limits', () => {
  const { app } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true' } });

  it('limits sign-in attempts per email address (any case)', async () => {
    const attempt = (email: string) => request(app).post('/v1/auth/login').send({ email, password: 'Wrong-password-1' });
    for (let i = 0; i < RATE_LIMITS.loginPerEmail.limit; i += 1) {
      await attempt(i % 2 === 0 ? 'target@example.com' : 'TARGET@example.com').expect(401);
    }
    const limited = await attempt('target@example.com').expect(429);
    expect(limited.body).toEqual({ code: 'RATE_LIMITED', message: expect.any(String) });
    // Other addresses are not affected.
    await attempt('someone-else@example.com').expect(401);
  });

  it('limits reset emails per address', async () => {
    const attempt = () => request(app).post('/v1/auth/password-reset').send({ email: 'reset-target@example.com' });
    for (let i = 0; i < RATE_LIMITS.passwordResetPerEmail.limit; i += 1) await attempt().expect(200);
    await attempt().expect(429);
  });
});
