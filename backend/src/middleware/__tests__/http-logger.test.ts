import { Writable } from 'node:stream';

import express, { Router } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { redactUrl } from '../../lib/logger.js';
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
});

describe('httpLogger', () => {
  it('logs the request line without the push token', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const router = Router();
    router.delete('/me/devices/:token', (_req, res) => {
      res.json({ success: true });
    });
    const app = express();
    app.use(requestId());
    app.use(httpLogger(pino({ level: 'info' }, sink)));
    app.use('/v1', router);

    await request(app).delete(`/v1/me/devices/${encodeURIComponent(PUSH_TOKEN)}`).expect(200);
    const logged = lines.join('');
    expect(logged).toContain('"url":"/v1/me/devices/[REDACTED]"');
    expect(logged).not.toContain('xYz-123_abc');
  });
});
