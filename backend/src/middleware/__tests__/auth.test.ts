import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../test/app.js';
import { accessTokenFor, bearer } from '../../../test/auth.js';
import { newObjectId } from '../../lib/ids.js';
import { createSilentLogger } from '../../lib/logger.js';
import { authOf, requireAuth, requireRole } from '../auth.js';
import { errorHandler } from '../error-handler.js';

describe('requireAuth / requireRole', () => {
  const deps = createTestDeps();
  const app = express();
  app.get('/me', requireAuth(deps), (req, res) => {
    const auth = authOf(req);
    res.json({ userId: auth.userId.toHexString(), role: auth.role });
  });
  app.get('/pro-only', requireAuth(deps), requireRole('professional'), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler(createSilentLogger()));

  const customer = { _id: newObjectId(), role: 'customer' as const };

  it('accepts a valid bearer token', async () => {
    const res = await request(app).get('/me').set(bearer(accessTokenFor(deps, customer))).expect(200);
    expect(res.body).toEqual({ userId: customer._id.toHexString(), role: 'customer' });
  });

  it('answers 401 UNAUTHORIZED without, with a malformed or with an expired token', async () => {
    expect((await request(app).get('/me').expect(401)).body).toEqual({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    await request(app).get('/me').set('Authorization', 'Bearer nope').expect(401);
    await request(app).get('/me').set('Authorization', 'Basic abc').expect(401);

    const token = accessTokenFor(deps, customer);
    deps.clock.advanceMinutes(31);
    const res = await request(app).get('/me').set(bearer(token)).expect(401);
    expect(res.body.message).toBe('Invalid or expired access token');
  });

  it('answers 403 FORBIDDEN for the wrong role', async () => {
    const res = await request(app).get('/pro-only').set(bearer(accessTokenFor(deps, customer))).expect(403);
    expect(res.body).toEqual({ code: 'FORBIDDEN', message: 'This endpoint is only available to professionals' });
    await request(app)
      .get('/pro-only')
      .set(bearer(accessTokenFor(deps, { _id: newObjectId(), role: 'professional' })))
      .expect(200);
  });
});
