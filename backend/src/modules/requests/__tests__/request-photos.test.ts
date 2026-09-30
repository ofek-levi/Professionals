import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { TEL_AVIV } from '../../../../test/factories.js';
import { HEIC, JPEG, PDF, PNG, WEBP, withForm } from '../../../../test/images.js';
import { hitFixedWindow } from '../../../infra/fixed-window.js';
import { imageBytesKey } from '../../../infra/storage/image-quota.js';
import { UnconfiguredStorage } from '../../../infra/storage/unconfigured-storage.js';
import { API_LIMITS, APP_CONFIG } from '../../../shared/limits.js';
import { RequestModel } from '../request.model.js';

const { ClientSession } = mongoose.mongo;

/** The next commit is applied, but its caller gets an error (the reply was lost). */
function loseNextCommitReply() {
  const { prototype } = ClientSession;
  const commit = Reflect.get(prototype, 'commitTransaction') as (this: typeof prototype) => Promise<unknown>;
  vi.spyOn(prototype, 'commitTransaction').mockImplementationOnce(async function (this: typeof prototype) {
    await commit.call(this);
    throw new mongoose.mongo.MongoError('connection reset while reading the commit reply');
  });
}
import { postRequest, requestBody, type Caller } from './marketplace-fixtures.js';

type Photo = { publicId: string; url: string };

describe('request photos', () => {
  const { app, deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.storage.images.clear();
    vi.restoreAllMocks();
  });

  const post = (caller: Caller, data: Record<string, unknown>, photos: Buffer[] = []) =>
    withForm(request(app).post('/v1/requests').set(caller.headers), data, photos);
  const edit = (caller: Caller, id: string, data: Record<string, unknown>, photos: Buffer[] = []) =>
    withForm(request(app).patch(`/v1/requests/${id}`).set(caller.headers), data, photos);
  const stored = () => [...deps.storage.images.keys()].sort();
  const ids = (photos: Photo[]) => photos.map((photo) => photo.publicId);

  describe('POST /v1/requests', () => {
    it('stores the photos with the request, in the order sent; professionals see them too', async () => {
      const customer = await signInCustomer(deps);
      const res = await post(customer, requestBody(), [JPEG, PNG, WEBP, HEIC]).expect(201);
      const photos = res.body.photos as Photo[];
      expect(photos).toHaveLength(4);
      expect(photos[0]).toEqual({ publicId: expect.stringMatching(/^test\/requests\//), url: expect.stringMatching(/^https:\/\/images\.test\//) });
      expect(ids(photos)).toEqual(stored());
      expect([...deps.storage.images.values()].map((image) => image.bytes)).toEqual([JPEG, PNG, WEBP, HEIC].map((file) => file.length));
      expect((await RequestModel.findById(res.body.id).lean())?.photos).toEqual(photos);

      const asPro = await request(app).get(`/v1/requests/${res.body.id as string}`).set((await signInProfessional(deps)).headers).expect(200);
      expect(asPro.body.request.photos).toEqual(photos);
    });

    it('a retried post returns the first request without uploading again; a lost race deletes its photos', async () => {
      const customer = await signInCustomer(deps);
      const body = requestBody({ clientRequestId: 'form-1' });
      const first = await post(customer, body, [JPEG, PNG]).expect(201);
      const upload = vi.spyOn(deps.storage, 'upload');
      const retry = await post(customer, body, [JPEG, PNG]).expect(201);
      expect(retry.body).toMatchObject({ id: first.body.id, photos: first.body.photos });
      expect(upload).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(2);

      // Two posts at once: one request, and only its photos stay stored.
      const twice = await Promise.all([1, 2].map(() => post(customer, requestBody({ clientRequestId: 'form-2' }), [JPEG])));
      expect(twice[0]?.body.id).toBe(twice[1]?.body.id);
      expect(stored()).toEqual([...ids(first.body.photos), ...ids(twice[0]?.body.photos)].sort());
      expect(await RequestModel.countDocuments({})).toBe(2);
    });

    it('refuses files that are not images, and stores nothing', async () => {
      const customer = await signInCustomer(deps);
      for (const files of [[PDF], [JPEG, PDF], [Buffer.alloc(0)]]) {
        const res = await post(customer, requestBody(), files).expect(400);
        expect(res.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), fieldErrors: { photos: ['validation:upload.invalid'] } });
      }
      // A payload error is reported before anything is uploaded.
      const invalid = await post(customer, requestBody({ description: 'short' }), [JPEG]).expect(400);
      expect(invalid.body.fieldErrors).toEqual({ description: ['validation:request.descriptionTooShort'] });
      const tooSoon = await post(customer, requestBody({ urgency: 'emergency', preferredSchedule: { date: '2026-10-03', timeWindow: 'any' } }), [JPEG]).expect(400);
      expect(tooSoon.body.fieldErrors).toEqual({ 'preferredSchedule.date': ['validation:request.preferredDateBeyondUrgency'] });
      expect(stored()).toEqual([]);
      expect(await RequestModel.countDocuments({})).toBe(0);
    });

    it('limits the number and the size of the photos', async () => {
      const customer = await signInCustomer(deps);
      const tooMany = await post(customer, requestBody(), Array.from({ length: APP_CONFIG.maxRequestPhotos + 1 }, () => JPEG)).expect(400);
      expect(tooMany.body.fieldErrors).toEqual({ photos: ['validation:request.tooManyPhotos'] });
      const big = Buffer.concat([JPEG, Buffer.alloc(APP_CONFIG.maxUploadBytes)]);
      const tooLarge = await post(customer, requestBody(), [big]).expect(413);
      expect(tooLarge.body).toMatchObject({ code: 'VALIDATION_ERROR', fieldErrors: { photos: ['validation:upload.invalid'] } });
      await post(customer, requestBody(), Array.from({ length: APP_CONFIG.maxRequestPhotos }, () => JPEG)).expect(201);
    });

    it('reads multipart only, with the payload as a JSON object in `data`', async () => {
      const customer = await signInCustomer(deps);
      const json = await request(app).post('/v1/requests').set(customer.headers).send(requestBody()).expect(400);
      expect(json.body.fieldErrors).toEqual({ data: ['validation:required'] });
      const cases: [string, Record<string, string[]>][] = [
        ['{"categoryId":', { data: ['validation:invalid'] }],
        ['[1,2]', { data: ['validation:invalid'] }],
        [JSON.stringify({ ...requestBody(), location: { $where: 'sleep(1000)' } }), { 'location.$where': ['validation:invalid'] }],
      ];
      for (const [data, fieldErrors] of cases) {
        const res = await request(app).post('/v1/requests').set(customer.headers).field('data', data).expect(400);
        expect(res.body.fieldErrors, data).toEqual(fieldErrors);
      }
      const wrongField = await request(app)
        .post('/v1/requests')
        .set(customer.headers)
        .field('data', JSON.stringify(requestBody()))
        .attach('photo', JPEG, 'a.jpg')
        .expect(400);
      expect(wrongField.body.fieldErrors).toEqual({ photo: ['validation:upload.invalid'] });
      expect(await RequestModel.countDocuments({})).toBe(0);
    });

    it('deletes the stored photos when the request cannot be saved or a photo cannot be stored', async () => {
      const customer = await signInCustomer(deps);
      vi.spyOn(RequestModel, 'create').mockRejectedValueOnce(new Error('database down'));
      await post(customer, requestBody(), [JPEG, PNG]).expect(500);
      expect(stored()).toEqual([]);

      const upload = deps.storage.upload.bind(deps.storage);
      vi.spyOn(deps.storage, 'upload')
        .mockImplementationOnce(upload)
        .mockRejectedValueOnce(new Error('Cloudinary upload failed: timeout'));
      const res = await post(customer, requestBody(), [JPEG, PNG]).expect(503);
      expect(res.body).toMatchObject({ code: 'SERVER_ERROR', fieldErrors: { photos: ['validation:upload.unavailable'] } });
      expect(stored()).toEqual([]);
      expect(await RequestModel.countDocuments({})).toBe(0);
    });

    it('keeps the photos when the save may have committed; a retry answers the request with them', async () => {
      const customer = await signInCustomer(deps);
      const body = requestBody({ clientRequestId: 'form-lost-commit' });
      loseNextCommitReply();
      await post(customer, body, [JPEG, PNG]).expect(500);
      const saved = await RequestModel.findOne({ clientRequestId: 'form-lost-commit' }).lean();
      expect(ids(saved?.photos ?? [])).toEqual(stored());
      expect(stored()).toHaveLength(2);

      const retry = await post(customer, body, [JPEG, PNG]).expect(201);
      expect(retry.body).toMatchObject({ id: saved?._id.toHexString(), photos: saved?.photos });
      expect(stored()).toHaveLength(2);
    });

    it('keeps (and logs) the photos when the request cannot be read again after an unknown failure', async () => {
      const customer = await signInCustomer(deps);
      vi.spyOn(RequestModel, 'create').mockRejectedValueOnce(new Error('connection lost'));
      vi.spyOn(RequestModel, 'findById').mockImplementationOnce(() => {
        throw new Error('still down');
      });
      const logged = vi.spyOn(deps.logger, 'error');
      await post(customer, requestBody(), [JPEG]).expect(500);
      expect(stored()).toHaveLength(1);
      expect(logged).toHaveBeenCalledWith(expect.objectContaining({ publicIds: stored() }), expect.stringContaining('kept'));
    });

    it('refuses photos past the user’s daily bytes (429 naming them) and stores nothing', async () => {
      const customer = await signInCustomer(deps);
      await hitFixedWindow(deps.redis, imageBytesKey(deps, customer.user._id.toHexString()), 24 * 60 * 60_000, API_LIMITS.imageBytesPerUserPerDay);
      const res = await post(customer, requestBody(), [JPEG]).expect(429);
      expect(res.body).toMatchObject({ code: 'RATE_LIMITED', fieldErrors: { photos: ['validation:upload.rateLimited'] } });
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(stored()).toEqual([]);
      // Without photos the request is still posted.
      await post(customer, requestBody()).expect(201);
    });
  });

  describe('PATCH /v1/requests/:id (drafts)', () => {
    it('keeps, reorders and adds photos; removed ones are deleted from storage', async () => {
      const customer = await signInCustomer(deps);
      const draft = await postRequest(app, customer, { publish: false }, TEL_AVIV, [JPEG, PNG]);
      const [a, b] = ids(draft.photos as Photo[]);

      const res = await edit(customer, draft.id, { keepPhotos: [b], notes: 'Ring twice' }, [WEBP]).expect(200);
      const photos = res.body.photos as Photo[];
      expect(ids(photos).slice(0, 1)).toEqual([b]);
      expect(photos).toHaveLength(2);
      expect(res.body.notes).toBe('Ring twice');
      await deps.background.drain();
      expect(stored()).toEqual(ids(photos).sort());
      expect(stored()).not.toContain(a);

      // Omitting `keepPhotos` keeps them all: no files → unchanged, files → added after them.
      const unchanged = await edit(customer, draft.id, { urgency: 'urgent' }).expect(200);
      expect(unchanged.body.photos).toEqual(photos);
      const added = await edit(customer, draft.id, {}, [HEIC]).expect(200);
      expect(ids(added.body.photos).slice(0, 2)).toEqual(ids(photos));
      const reordered = await edit(customer, draft.id, { keepPhotos: ids(added.body.photos).reverse() }).expect(200);
      expect(ids(reordered.body.photos)).toEqual(ids(added.body.photos).reverse());
      const cleared = await edit(customer, draft.id, { keepPhotos: [] }).expect(200);
      expect(cleared.body.photos).toEqual([]);
      await deps.background.drain();
      expect(stored()).toEqual([]);
    });

    it('a retried edit (the same form again) ends with the same photos, nothing left behind', async () => {
      const customer = await signInCustomer(deps);
      const draft = await postRequest(app, customer, { publish: false }, TEL_AVIV, [JPEG]);
      const keep = ids(draft.photos as Photo[]);
      await edit(customer, draft.id, { keepPhotos: keep }, [PNG]).expect(200);
      const retry = await edit(customer, draft.id, { keepPhotos: keep }, [PNG]).expect(200);
      expect(retry.body.photos).toHaveLength(2);
      await deps.background.drain();
      expect(stored()).toEqual(ids(retry.body.photos).sort());
    });

    it('refuses unknown photos, too many photos, published requests and other customers before uploading', async () => {
      const customer = await signInCustomer(deps);
      const draft = await postRequest(app, customer, { publish: false }, TEL_AVIV, [JPEG, PNG]);
      const open = await postRequest(app, customer);
      const upload = vi.spyOn(deps.storage, 'upload');

      const unknown = await edit(customer, draft.id, { keepPhotos: ['test/requests/nope'] }, [JPEG]).expect(400);
      expect(unknown.body.fieldErrors).toEqual({ keepPhotos: ['validation:request.photoNotFound'] });
      const tooMany = await edit(customer, draft.id, {}, Array.from({ length: APP_CONFIG.maxRequestPhotos - 1 }, () => JPEG)).expect(400);
      expect(tooMany.body.fieldErrors).toEqual({ photos: ['validation:request.tooManyPhotos'] });
      await edit(customer, open.id, {}, [JPEG]).expect(409);
      await edit(await signInCustomer(deps), draft.id, {}, [JPEG]).expect(403);
      expect(upload).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(2);
    });

    it('deletes the new photos when the edit fails after they were stored; the draft keeps its photos', async () => {
      const customer = await signInCustomer(deps);
      const draft = await postRequest(app, customer, { publish: false }, TEL_AVIV, [JPEG]);
      const before = draft.photos as Photo[];

      vi.spyOn(RequestModel, 'findOneAndUpdate').mockRejectedValueOnce(new Error('database down'));
      await edit(customer, draft.id, { keepPhotos: [] }, [PNG, WEBP]).expect(500);
      expect(stored()).toEqual(ids(before));

      // Published while its photos were being uploaded: the edit is refused inside the transaction.
      const upload = deps.storage.upload.bind(deps.storage);
      vi.spyOn(deps.storage, 'upload').mockImplementationOnce(async (input) => {
        await RequestModel.updateOne({ _id: draft.id }, { $set: { status: 'open', publishedAt: deps.clock.now() } });
        return upload(input);
      });
      await edit(customer, draft.id, {}, [PNG]).expect(409);
      expect(stored()).toEqual(ids(before));
      expect((await RequestModel.findById(draft.id).lean())?.photos).toEqual(before);
    });

    it('keeps the new photos when the edit may have committed', async () => {
      const customer = await signInCustomer(deps);
      const draft = await postRequest(app, customer, { publish: false }, TEL_AVIV, [JPEG]);
      loseNextCommitReply();
      await edit(customer, draft.id, {}, [PNG]).expect(500);
      const photos = (await RequestModel.findById(draft.id).lean())?.photos ?? [];
      expect(photos).toHaveLength(2);
      expect(stored()).toEqual(ids(photos).sort());
    });

    it('deleting a draft deletes its photos', async () => {
      const customer = await signInCustomer(deps);
      const draft = await postRequest(app, customer, { publish: false }, TEL_AVIV, [JPEG, PNG]);
      await request(app).delete(`/v1/requests/${draft.id}`).set(customer.headers).expect(200);
      await deps.background.drain();
      expect(stored()).toEqual([]);
    });
  });
});

describe('request photos without image storage (development)', () => {
  const { app, deps } = createTestApp({ deps: { storage: new UnconfiguredStorage() } });

  it('answers 503 for photos, but requests without photos still work', async () => {
    const customer = await signInCustomer(deps);
    const res = await withForm(request(app).post('/v1/requests').set(customer.headers), requestBody(), [JPEG]).expect(503);
    expect(res.body).toMatchObject({ code: 'SERVER_ERROR', fieldErrors: { photos: ['validation:upload.unavailable'] } });
    await withForm(request(app).post('/v1/requests').set(customer.headers), requestBody()).expect(201);
  });
});
