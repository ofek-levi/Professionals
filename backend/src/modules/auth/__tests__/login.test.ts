import argon2 from 'argon2';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { createCustomer, createProfessional } from '../../../../test/factories.js';
import { UserModel } from '../../users/user.model.js';
import { hashPassword } from '../passwords.js';
import { loginAccount, STRONG_PASSWORD } from './auth-test-helpers.js';

describe('POST /v1/auth/login', () => {
  const { app } = createTestApp();
  beforeEach(clearDatabase);

  it('signs in with a case-insensitive email', async () => {
    const user = await createCustomer({ email: 'noa@example.com', passwordHash: await hashPassword(STRONG_PASSWORD) });
    const session = await loginAccount(app, '  NOA@example.com ');
    expect(session).toMatchObject({ refreshToken: expect.any(String), user: { id: user._id.toHexString(), email: 'noa@example.com' } });
    await request(app).get('/v1/me').set('Authorization', `Bearer ${session.accessToken}`).expect(200);
  });

  it('shows the profile display name of a professional', async () => {
    const { user } = await createProfessional({
      user: { email: 'pro@example.com', passwordHash: await hashPassword(STRONG_PASSWORD) },
      professional: { displayName: 'Avi Fix Ltd' },
    });
    const session = await loginAccount(app, 'pro@example.com');
    expect(session.user).toMatchObject({ id: user._id.toHexString(), role: 'professional', displayName: 'Avi Fix Ltd' });
  });

  it('answers the same 401 for a wrong password, an unknown email and a Google-only account', async () => {
    await createCustomer({ email: 'noa@example.com', passwordHash: await hashPassword(STRONG_PASSWORD) });
    await createCustomer({ email: 'google@example.com', googleSub: 'google-1' });
    const attempts = [
      { email: 'noa@example.com', password: 'Wrong-password-1' },
      { email: 'nobody@example.com', password: STRONG_PASSWORD },
      { email: 'google@example.com', password: STRONG_PASSWORD },
    ];
    const bodies = await Promise.all(attempts.map(async (body) => (await request(app).post('/v1/auth/login').send(body).expect(401)).body));
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
    expect(bodies[0]).toEqual({ code: 'INVALID_CREDENTIALS', message: expect.any(String) });
  });

  it('validates the payload', async () => {
    const res = await request(app).post('/v1/auth/login').send({ email: '', password: '' }).expect(400);
    expect(res.body.fieldErrors).toEqual({ email: ['validation:auth.emailRequired'], password: ['validation:auth.passwordRequired'] });
  });

  it('upgrades a hash made with older argon2 parameters', async () => {
    const legacy = await argon2.hash(STRONG_PASSWORD, { type: argon2.argon2id, memoryCost: 8192, timeCost: 3, parallelism: 1 });
    const user = await createCustomer({ email: 'old@example.com', passwordHash: legacy });
    await loginAccount(app, 'old@example.com');
    const stored = await UserModel.findById(user._id, { passwordHash: 1 }).lean();
    expect(stored?.passwordHash).toMatch(/m=19456,p=1,t=2/);
    await loginAccount(app, 'old@example.com');
  });
});
