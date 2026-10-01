import { Writable } from 'node:stream';

import express, { Router } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { redactUrl } from '../../lib/logger.js';
import { errorHandler } from '../error-handler.js';
import { httpLogger } from '../http-logger.js';
import { requestId } from '../request-id.js';

const PUSH_TOKEN = 'ExponentPushToken[xYz-123_abc]';

describe('redactUrl', () => {
  it('masks token query parameters and the push token of DELETE /me/devices/:token', () => {
    expect(redactUrl('/realtime?token=eyJhbGciOi.abc&x=1')).toBe('/realtime?token=[REDACTED]&x=1');
    expect(redactUrl('/v1/auth/verify-email?token=abc')).toBe('/v1/auth/verify-email?token=[REDACTED]');
    expect(redactUrl(`/v1/me/devices/${encodeURIComponent(PUSH_TOKEN)}`)).toBe('/v1/me/devices/[REDACTED]');
    expect(redactUrl(`/v1/me/devices/${PUSH_TOKEN}?retry=1`)).toBe('/v1/me/devices/[REDACTED]?retry=1');
    expect(redactUrl('/v1/me/devices')).toBe('/v1/me/devices');
    expect(redactUrl('/v1/requests/66f1a0c2e4b0a1b2c3d4e5f6/offers')).toBe('/v1/requests/66f1a0c2e4b0a1b2c3d4e5f6/offers');
  });

  it('masks typed address searches and coordinates on any path', () => {
    expect(redactUrl('/v1/geo/search?q=Dizengoff%20120&limit=5')).toBe('/v1/geo/search?q=[REDACTED]&limit=5');
    expect(redactUrl('/v1/geo/reverse?lat=32.08531&lng=34.78177')).toBe('/v1/geo/reverse?lat=[REDACTED]&lng=[REDACTED]');
    expect(redactUrl('/v1/professionals?categoryId=plumbing&lat=32.0853&lng=34.7818&cursor=abc')).toBe(
      '/v1/professionals?categoryId=plumbing&lat=[REDACTED]&lng=[REDACTED]&cursor=abc',
    );
    // Only these exact parameter names.
    expect(redactUrl('/v1/requests/nearby?sort=nearest&maxDistanceKm=10')).toBe('/v1/requests/nearby?sort=nearest&maxDistanceKm=10');
  });
});

/** An app whose log lines (JSON) are collected in `lines`. */
function loggedApp(lines: string[]) {
  const sink = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const logger = pino({ level: 'info' }, sink);
  const app = express();
  app.use(requestId());
  app.use(httpLogger(logger));
  return { app, logger };
}

describe('httpLogger', () => {
  it('logs the request line without the push token', async () => {
    const lines: string[] = [];
    const { app } = loggedApp(lines);
    const router = Router();
    router.delete('/me/devices/:token', (_req, res) => {
      res.json({ success: true });
    });
    app.use('/v1', router);

    await request(app).delete(`/v1/me/devices/${encodeURIComponent(PUSH_TOKEN)}`).expect(200);
    const logged = lines.join('');
    expect(logged).toContain('"url":"/v1/me/devices/[REDACTED]"');
    expect(logged).not.toContain('xYz-123_abc');
  });

  it('masks the unhandled-error line the same way (push token in the path, search in the query)', async () => {
    const lines: string[] = [];
    const { app, logger } = loggedApp(lines);
    const router = Router();
    const fail = () => {
      throw new Error('database unreachable');
    };
    router.delete('/me/devices/:token', fail);
    router.get('/geo/search', fail);
    app.use('/v1', router);
    app.use(errorHandler(logger));

    await request(app).delete(`/v1/me/devices/${encodeURIComponent(PUSH_TOKEN)}`).expect(500);
    await request(app).get('/v1/geo/search').query({ q: 'Dizengoff 120', limit: 5 }).expect(500);
    const errors = lines.map((line) => JSON.parse(line) as { msg: string; path?: string }).filter((line) => line.msg === 'unhandled error');
    expect(errors.map((line) => line.path)).toEqual(['/v1/me/devices/[REDACTED]', '/v1/geo/search?q=[REDACTED]&limit=5']);
    const logged = lines.join('');
    expect(logged).not.toContain('xYz-123_abc');
    expect(logged).not.toContain('Dizengoff');
  });
});
