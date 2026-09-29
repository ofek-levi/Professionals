import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTestApp } from '../../../../test/app.js';

describe('health, readiness and generic HTTP behaviour', () => {
  const { app } = createTestApp();

  it('GET /health is always ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /ready checks MongoDB and Redis', async () => {
    const res = await request(app).get('/ready').expect(200);
    expect(res.body).toEqual({ status: 'ready', checks: { mongo: 'ok', redis: 'ok' } });
  });

  it('unknown routes answer 404 NOT_FOUND in the error format', async () => {
    const res = await request(app).get('/v1/nope').expect(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Route GET /v1/nope was not found' });
  });

  it('malformed JSON answers 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/v1/anything').set('Content-Type', 'application/json').send('{"a":').expect(400);
    expect(res.body).toEqual({ code: 'VALIDATION_ERROR', message: 'Malformed JSON body', fieldErrors: { root: ['validation:invalid'] } });
  });

  it('bodies over 100kb are rejected', async () => {
    const res = await request(app)
      .post('/v1/anything')
      .send({ text: 'x'.repeat(110 * 1024) })
      .expect(413);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects $-operator keys in bodies and queries', async () => {
    const body = await request(app).post('/v1/anything').send({ email: { $ne: null } }).expect(400);
    expect(body.body.fieldErrors).toEqual({ 'email.$ne': ['validation:invalid'] });
    const query = await request(app).get('/v1/catalog/categories?$where=1').expect(400);
    expect(query.body.fieldErrors).toEqual({ $where: ['validation:invalid'] });
  });

  it('echoes a request id and sets security headers', async () => {
    const generated = await request(app).get('/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const echoed = await request(app).get('/health').set('X-Request-Id', 'client-req-12345');
    expect(echoed.headers['x-request-id']).toBe('client-req-12345');
    expect(echoed.headers['x-powered-by']).toBeUndefined();
    expect(echoed.headers['x-content-type-options']).toBe('nosniff');
  });
});
