import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { JPEG, PDF, PNG } from '../../../../test/images.js';
import { UnconfiguredStorage } from '../../../infra/storage/unconfigured-storage.js';
import { APP_CONFIG } from '../../../shared/limits.js';
import { UserModel } from '../user.model.js';

describe('PUT/DELETE /v1/me/avatar', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.storage.images.clear();
    deps.realtime.clear();
    vi.restoreAllMocks();
  });

  const put = (headers: Record<string, string>, file: Buffer, field = 'avatar') =>
    request(app).put('/v1/me/avatar').set(headers).attach(field, file, { filename: 'me.jpg', contentType: 'image/jpeg' });
  const avatarOf = async (id: unknown) => (await UserModel.findById(id).lean())?.avatar;

  it('sets, replaces and removes the avatar; replaced images are deleted from storage', async () => {
    const customer = await signInCustomer(deps);
    const first = await put(customer.headers, JPEG).expect(200);
    // The same body as `GET /me`.
    expect(first.body).toMatchObject({ user: { id: customer.user._id.toHexString(), avatarUrl: expect.stringMatching(/^https:\/\/images\.test\//) } });
    expect(first.body.customerProfile).toMatchObject({ userId: customer.user._id.toHexString() });
    const [firstId] = [...deps.storage.images.keys()];
    expect(deps.storage.images.get(firstId ?? '')).toMatchObject({ folder: 'avatars', url: first.body.user.avatarUrl });
    expect(await avatarOf(customer.user._id)).toEqual({ url: first.body.user.avatarUrl, publicId: firstId });

    const second = await put(customer.headers, PNG).expect(200);
    expect(second.body.user.avatarUrl).not.toBe(first.body.user.avatarUrl);
    await deps.background.drain();
    expect([...deps.storage.images.values()].map((image) => image.url)).toEqual([second.body.user.avatarUrl]);

    const removed = await request(app).delete('/v1/me/avatar').set(customer.headers).expect(200);
    expect(removed.body.user.avatarUrl).toBeNull();
    await deps.background.drain();
    expect(deps.storage.images.size).toBe(0);
    expect(await avatarOf(customer.user._id)).toBeNull();
    // Idempotent.
    await request(app).delete('/v1/me/avatar').set(customer.headers).expect(200);
  });

  it('never deletes a Google profile picture (not ours)', async () => {
    const customer = await signInCustomer(deps, { avatar: { url: 'https://lh3.googleusercontent.com/a/photo', publicId: null } });
    const destroy = vi.spyOn(deps.storage, 'destroy');
    await put(customer.headers, JPEG).expect(200);
    await request(app).delete('/v1/me/avatar').set(customer.headers).expect(200);
    await deps.background.drain();
    // Only our own upload was deleted.
    expect(destroy.mock.calls.flat(2)).toEqual([expect.stringMatching(/^test\/avatars\//)]);
  });

  it('updates a professional’s profile everywhere it is shown', async () => {
    const pro = await signInProfessional(deps);
    const res = await put(pro.headers, JPEG).expect(200);
    expect(res.body.professionalProfile.avatarUrl).toBe(res.body.user.avatarUrl);
    const publicProfile = await request(app).get(`/v1/professionals/${pro.user._id.toHexString()}`).set((await signInCustomer(deps)).headers).expect(200);
    expect(publicProfile.body.avatarUrl).toBe(res.body.user.avatarUrl);
    expect(deps.realtime.eventsFor(pro.user._id.toHexString()).map((event) => event.type)).toContain('profile.updated');
  });

  it('refuses what is not one image and changes nothing', async () => {
    const customer = await signInCustomer(deps);
    const notImage = await put(customer.headers, PDF).expect(400);
    expect(notImage.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), fieldErrors: { avatar: ['validation:upload.invalid'] } });
    const tooLarge = await put(customer.headers, Buffer.concat([JPEG, Buffer.alloc(APP_CONFIG.maxUploadBytes)])).expect(413);
    expect(tooLarge.body.fieldErrors).toEqual({ avatar: ['validation:upload.invalid'] });
    const two = await request(app).put('/v1/me/avatar').set(customer.headers).attach('avatar', JPEG, 'a.jpg').attach('avatar', PNG, 'b.png').expect(400);
    expect(two.body.fieldErrors).toEqual({ avatar: ['validation:upload.invalid'] });
    const wrongField = await put(customer.headers, JPEG, 'file').expect(400);
    expect(wrongField.body.fieldErrors).toEqual({ file: ['validation:upload.invalid'] });
    const noFile = await request(app).put('/v1/me/avatar').set(customer.headers).field('note', 'x').expect(400);
    expect(noFile.body.fieldErrors).toEqual({ avatar: ['validation:upload.invalid'] });
    const json = await request(app).put('/v1/me/avatar').set(customer.headers).send({ avatarUrl: 'https://tracker.example/pixel.gif' }).expect(400);
    expect(json.body.fieldErrors).toEqual({ avatar: ['validation:upload.invalid'] });
    await put({}, JPEG).expect(401);
    expect(deps.storage.images.size).toBe(0);
    expect(await avatarOf(customer.user._id)).toBeNull();
  });

  it('deletes the new image when the account is gone', async () => {
    const customer = await signInCustomer(deps);
    await UserModel.deleteOne({ _id: customer.user._id });
    await put(customer.headers, JPEG).expect(401);
    expect(deps.storage.images.size).toBe(0);
  });
});

describe('PUT /v1/me/avatar without image storage (development)', () => {
  const { app, deps } = createTestApp({ deps: { storage: new UnconfiguredStorage() } });

  it('answers 503 before reading the image', async () => {
    const customer = await signInCustomer(deps);
    const res = await request(app).put('/v1/me/avatar').set(customer.headers).attach('avatar', JPEG, 'a.jpg').expect(503);
    expect(res.body.code).toBe('SERVER_ERROR');
  });
});

describe('image rate limit', () => {
  const { app, deps } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true' } });

  it('limits the image posts of a user (avatars and requests share it); the 429 names the image field', async () => {
    const customer = await signInCustomer(deps);
    const other = await signInCustomer(deps);
    // Refused ones count too: the limit protects the upload path, not only successes.
    for (let i = 0; i < 60; i += 1) await request(app).put('/v1/me/avatar').set(customer.headers).expect(400);
    const res = await request(app).put('/v1/me/avatar').set(customer.headers).attach('avatar', JPEG, 'a.jpg').expect(429);
    expect(res.body).toMatchObject({ code: 'RATE_LIMITED', fieldErrors: { avatar: ['validation:upload.rateLimited'] } });
    const post = await request(app).post('/v1/requests').set(customer.headers).field('data', '{}').expect(429);
    expect(post.body.fieldErrors).toEqual({ photos: ['validation:upload.rateLimited'] });
    await request(app).put('/v1/me/avatar').set(other.headers).attach('avatar', JPEG, 'a.jpg').expect(200);
  });

  it('a post over the request limit is refused without naming the photos (it is not about them)', async () => {
    const customer = await signInCustomer(deps);
    for (let i = 0; i < 30; i += 1) await request(app).post('/v1/requests').set(customer.headers).field('data', '{}').expect(400);
    const res = await request(app).post('/v1/requests').set(customer.headers).field('data', '{}').attach('photos', JPEG, 'a.jpg').expect(429);
    expect(res.body).toEqual({ code: 'RATE_LIMITED', message: expect.any(String) });
  });
});
