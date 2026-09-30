import http from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearDatabase, createTestApp } from '../../../test/app.js';
import { signInCustomer } from '../../../test/auth.js';
import { requestBody } from '../../modules/requests/__tests__/marketplace-fixtures.js';
import { JPEG, withForm } from '../../../test/images.js';
import type { StoredImage } from '../../infra/storage/index.js';
import { createSilentLogger } from '../../lib/logger.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { errorHandler } from '../error-handler.js';
import { admitImagePost, ImagePostAdmission } from '../image-admission.js';
import { maxImageBodyBytes } from '../multipart.js';

describe('ImagePostAdmission', () => {
  it('admits a few posts per user and a byte budget per process; a release is counted once', () => {
    const admission = new ImagePostAdmission({ maxBytes: 100, postsPerUser: 2 });
    const first = admission.admit('a', 30);
    const second = admission.admit('a', 30);
    expect(admission.admit('a', 1)).toEqual({ refused: 'user' });
    expect(admission.admit('b', 41)).toEqual({ refused: 'server' });
    const third = admission.admit('b', 40);
    expect(admission.bytesInFlight).toBe(100);
    for (const admitted of [first, second, third]) {
      if (!('release' in admitted)) throw new Error('admitted');
      admitted.release();
      admitted.release();
    }
    expect(admission.bytesInFlight).toBe(0);
    expect(admission.admit('a', 100)).toHaveProperty('release');
  });
});

describe('admitImagePost', () => {
  function appWith(admission: ImagePostAdmission, maxBodyBytes: number) {
    const app = express();
    app.use((req, _res, next) => {
      req.auth = { userId: new Types.ObjectId(), role: 'customer', sessionId: 'session' };
      next();
    });
    app.post('/avatar', admitImagePost(admission, 'avatar', maxBodyBytes), (req, res) => {
      req.resume();
      req.on('end', () => res.json({ ok: true }));
    });
    app.use(errorHandler(createSilentLogger()));
    return app;
  }

  it('refuses a body larger than a post can be without reading it (413)', async () => {
    const admission = new ImagePostAdmission({ maxBytes: 10_000, postsPerUser: 2 });
    const app = appWith(admission, 100);
    const res = await request(app).post('/avatar').set('Content-Type', 'application/octet-stream').send(Buffer.alloc(101)).expect(413);
    expect(res.body.fieldErrors).toEqual({ avatar: ['validation:upload.invalid'] });
    await request(app).post('/avatar').set('Content-Type', 'application/octet-stream').send(Buffer.alloc(100)).expect(200);
    expect(admission.bytesInFlight).toBe(0);
  });

  it('counts a body without Content-Length (chunked) as the largest post', async () => {
    const server = appWith(new ImagePostAdmission({ maxBytes: 150, postsPerUser: 2 }), 200).listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = http.request({ port, method: 'POST', path: '/avatar', headers: { 'Transfer-Encoding': 'chunked' } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on('error', reject);
        req.end('small');
      });
      expect(status).toBe(503);
    } finally {
      server.close();
    }
  });
});

describe('image posts in flight (API)', () => {
  const { app, deps } = createTestApp();
  afterEach(async () => {
    await clearDatabase();
    vi.restoreAllMocks();
  });

  /** Uploads wait for `release()`, like slow Cloudinary uploads; returns how many are waiting. */
  function holdUploads() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const upload = deps.storage.upload.bind(deps.storage);
    const spy = vi.spyOn(deps.storage, 'upload').mockImplementation(async (input): Promise<StoredImage> => {
      await gate;
      return upload(input);
    });
    return { release, waiting: () => spy.mock.calls.length };
  }

  const putAvatar = (headers: Record<string, string>) => request(app).put('/v1/me/avatar').set(headers).attach('avatar', JPEG, 'a.jpg');

  it('lets a user run two image posts at once (429 naming the field past that); others are not affected', async () => {
    const [customer, other] = [await signInCustomer(deps), await signInCustomer(deps)];
    const held = holdUploads();
    const inFlight = [putAvatar(customer.headers).then((res) => res.status), putAvatar(customer.headers).then((res) => res.status)];
    await vi.waitFor(() => expect(held.waiting()).toBe(2));

    const busy = await putAvatar(customer.headers).expect(429);
    expect(busy.body).toMatchObject({ code: 'RATE_LIMITED', fieldErrors: { avatar: ['validation:upload.rateLimited'] } });
    expect(busy.headers['retry-after']).toBe('10');
    const post = await withForm(request(app).post('/v1/requests').set(customer.headers), requestBody(), [JPEG]).expect(429);
    expect(post.body.fieldErrors).toEqual({ photos: ['validation:upload.rateLimited'] });
    const otherPost = putAvatar(other.headers).then((res) => res.status);
    await vi.waitFor(() => expect(held.waiting()).toBe(3));

    held.release();
    expect(await Promise.all([...inFlight, otherPost])).toEqual([200, 200, 200]);
    expect(deps.imageAdmission.bytesInFlight).toBe(0);
    await putAvatar(customer.headers).expect(200);
  });

  it('a client that goes away frees its place', async () => {
    const customer = await signInCustomer(deps);
    const held = holdUploads();
    const server = app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const body = Buffer.concat([
        Buffer.from('--b\r\nContent-Disposition: form-data; name="avatar"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'),
        JPEG,
      ]);
      // A body that never ends: the post is admitted and waits for the rest of it.
      const req = http.request({
        port,
        method: 'PUT',
        path: '/v1/me/avatar',
        headers: { ...customer.headers, 'Content-Type': 'multipart/form-data; boundary=b', 'Content-Length': body.length + 100 },
      });
      req.on('error', () => undefined);
      req.write(body);
      await vi.waitFor(() => expect(deps.imageAdmission.bytesInFlight).toBe(body.length + 100));
      req.destroy();
      await vi.waitFor(() => expect(deps.imageAdmission.bytesInFlight).toBe(0));
      expect(held.waiting()).toBe(0);
    } finally {
      held.release();
      server.close();
    }
  });
});

describe('image posts over the process budget (API)', () => {
  const budget = maxImageBodyBytes({ maxFiles: 1 });
  const { app, deps } = createTestApp({ deps: { imageAdmission: new ImagePostAdmission({ maxBytes: budget, postsPerUser: 2 }) } });

  it('answers 503 naming the field, with Retry-After, while the budget is used', async () => {
    const customer = await signInCustomer(deps);
    const taken = deps.imageAdmission.admit('someone-else', budget - 100);
    if (!('release' in taken)) throw new Error('admitted');
    const res = await request(app).put('/v1/me/avatar').set(customer.headers).attach('avatar', JPEG, 'a.jpg').expect(503);
    expect(res.body).toMatchObject({ code: 'SERVER_ERROR', fieldErrors: { avatar: ['validation:upload.unavailable'] } });
    expect(res.headers['retry-after']).toBe('10');
    taken.release();
    await request(app).put('/v1/me/avatar').set(customer.headers).attach('avatar', JPEG, 'a.jpg').expect(200);
  });

  it('the largest post fits the smallest budget the server accepts', () => {
    expect(maxImageBodyBytes({ maxFiles: APP_CONFIG.maxRequestPhotos, jsonField: 'data' })).toBeLessThan(64 * 1024 * 1024);
  });
});
