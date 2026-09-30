import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createUpload } from '../../../../test/factories.js';
import { UnconfiguredStorage } from '../../../infra/storage/unconfigured-storage.js';
import { API_LIMITS } from '../../../shared/limits.js';
import { detectImageType } from '../image-signature.js';
import { chargeUploadBytes, UPLOAD_QUOTAS } from '../upload-quota.js';
import { UploadModel } from '../upload.model.js';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj');

describe('POST /v1/uploads/images', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.storage.images.clear();
  });

  it('stores the image and records the upload for its owner', async () => {
    const customer = await signInCustomer(deps);
    const res = await request(app)
      .post('/v1/uploads/images')
      .set(customer.headers)
      .field('width', '1200')
      .attach('file', JPEG, { filename: 'sink.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body).toEqual({ id: expect.stringMatching(/^[a-f0-9]{24}$/), url: expect.stringContaining('https://images.test/'), width: 800, height: 600 });
    const upload = await UploadModel.findById(res.body.id).lean();
    expect(upload).toMatchObject({ url: res.body.url, attachedAt: null });
    expect(upload?.owner.equals(customer.user._id)).toBe(true);
    const [stored] = [...deps.storage.images.values()];
    expect(stored).toMatchObject({ folder: 'images', bytes: JPEG.length, url: res.body.url });
  });

  it('accepts professionals too (avatars)', async () => {
    const pro = await signInProfessional(deps);
    await request(app).post('/v1/uploads/images').set(pro.headers).attach('file', PNG, 'me.png').expect(201);
  });

  it('requires a session', async () => {
    const res = await request(app).post('/v1/uploads/images').attach('file', JPEG, 'a.jpg').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects files that are not images whatever their declared type', async () => {
    const customer = await signInCustomer(deps);
    const res = await request(app)
      .post('/v1/uploads/images')
      .set(customer.headers)
      .attach('file', PDF, { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(400);
    expect(res.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), fieldErrors: { file: ['validation:upload.invalid'] } });
    expect(deps.storage.images.size).toBe(0);
    expect(await UploadModel.countDocuments()).toBe(0);
  });

  it('asks for the file field', async () => {
    const customer = await signInCustomer(deps);
    const json = await request(app).post('/v1/uploads/images').set(customer.headers).send({ uri: 'file:///a.jpg' }).expect(400);
    expect(json.body.fieldErrors).toEqual({ file: ['validation:upload.invalid'] });
    const wrongField = await request(app).post('/v1/uploads/images').set(customer.headers).attach('photo', JPEG, 'a.jpg').expect(400);
    expect(wrongField.body.fieldErrors).toEqual({ photo: ['validation:upload.invalid'] });
  });

  it('rejects files over the size limit', async () => {
    const customer = await signInCustomer(deps);
    const big = Buffer.concat([JPEG, Buffer.alloc(API_LIMITS.uploadMaxBytes)]);
    const res = await request(app).post('/v1/uploads/images').set(customer.headers).attach('file', big, 'big.jpg').expect(400);
    expect(res.body.fieldErrors).toEqual({ file: ['validation:upload.invalid'] });
    expect(deps.storage.images.size).toBe(0);
  });
});

describe('POST /v1/uploads/images quotas', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('caps unattached uploads per user; attaching one frees a slot', async () => {
    const customer = await signInCustomer(deps);
    for (let i = 0; i < UPLOAD_QUOTAS.pendingUploadsPerUser; i += 1) await createUpload(customer.user);
    const res = await request(app).post('/v1/uploads/images').set(customer.headers).attach('file', JPEG, 'a.jpg').expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    // Another user is not affected; an attached upload no longer counts.
    await request(app).post('/v1/uploads/images').set((await signInCustomer(deps)).headers).attach('file', JPEG, 'a.jpg').expect(201);
    await UploadModel.updateOne({ owner: customer.user._id }, { $set: { attachedAt: deps.clock.now() } });
    await request(app).post('/v1/uploads/images').set(customer.headers).attach('file', JPEG, 'a.jpg').expect(201);
  });

  it('caps the bytes uploaded per user per day', async () => {
    const customer = await signInCustomer(deps);
    await chargeUploadBytes(deps, customer.user._id.toHexString(), UPLOAD_QUOTAS.uploadBytesPerUserPerDay - JPEG.length);
    await request(app).post('/v1/uploads/images').set(customer.headers).attach('file', JPEG, 'a.jpg').expect(201);
    const res = await request(app).post('/v1/uploads/images').set(customer.headers).attach('file', JPEG, 'b.jpg').expect(429);
    expect(res.body.message).toContain('Daily upload limit');
  });
});

describe('POST /v1/uploads/images without storage credentials', () => {
  const { app, deps } = createTestApp({ deps: { storage: new UnconfiguredStorage() } });

  it('answers 503 before reading the file', async () => {
    const customer = await signInCustomer(deps);
    const res = await request(app).post('/v1/uploads/images').set(customer.headers).attach('file', JPEG, 'a.jpg').expect(503);
    expect(res.body.code).toBe('SERVER_ERROR');
  });
});

describe('POST /v1/uploads/images rate limit', () => {
  const { app, deps } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true' } });

  it('limits uploads per user', async () => {
    const customer = await signInCustomer(deps);
    const other = await signInCustomer(deps);
    // Rejections (400) count too: the limit protects the upload path, not only successes.
    for (let i = 0; i < 60; i += 1) await request(app).post('/v1/uploads/images').set(customer.headers).expect(400);
    const res = await request(app).post('/v1/uploads/images').set(customer.headers).attach('file', JPEG, 'a.jpg').expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    await request(app).post('/v1/uploads/images').set(other.headers).attach('file', JPEG, 'a.jpg').expect(201);
  });
});

describe('detectImageType', () => {
  it('recognises the accepted formats by their signature', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
    expect(detectImageType(HEIC)).toBe('image/heic');
    expect(detectImageType(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypmif1'), Buffer.alloc(4)]))).toBe('image/heif');
    expect(detectImageType(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif'), Buffer.alloc(4)]))).toBeNull();
    expect(detectImageType(PDF)).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
