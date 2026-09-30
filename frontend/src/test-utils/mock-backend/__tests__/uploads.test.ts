/**
 * `POST /uploads/images` is multipart (field `file`), like the backend, and avatars must be the
 * caller's own uploads.
 */
import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;

function imagePart(name: string, type: string) {
  const form = new FormData();
  form.append('file', { uri: `file:///photos/${name}`, name, type } as unknown as Blob);
  return form;
}

async function upload(env: TestEnvironment, userId: string | null, body: unknown) {
  return env.transport({
    method: 'POST',
    path: '/uploads/images',
    body,
    headers: userId ? { Authorization: `Bearer ${env.accessTokenFor(userId)}` } : {},
  });
}

describe('image uploads', () => {
  it('sends the picked image as a multipart `file` part and answers 201', async () => {
    const env = createTestEnvironment();
    const image = await env.as(NOA).uploads.uploadImage({ uri: 'file:///leak.heic', mimeType: 'image/heic', width: null, height: null, fileName: null });
    expect(image).toEqual({ id: expect.any(String), url: `https://images.test/${image.id}.heic`, width: 1600, height: 1200 });
    const [sent] = env.log.to('/uploads/images', 'POST');
    expect(sent.status).toBe(201);
    expect(sent.headers['Content-Type']).toBeUndefined(); // fetch writes the multipart boundary
    expect((sent.body as FormData & { getParts(): unknown[] }).getParts()).toEqual([
      expect.objectContaining({ fieldName: 'file', uri: 'file:///leak.heic', name: 'photo.heic', type: 'image/heic' }),
    ]);
    expect(env.server.internals.db.uploads.require(image.id, 'Upload')).toMatchObject({ ownerId: NOA, mimeType: 'image/heic' });
  });

  it('refuses anything but an image in `file`', async () => {
    const env = createTestEnvironment();
    const seeded = env.server.internals.db.uploads.size;
    const invalid = { code: 'VALIDATION_ERROR', fieldErrors: { file: ['validation:upload.invalid'] } };
    // The old JSON contract (a local uri) is gone.
    expect(await upload(env, NOA, { uri: 'file:///leak.jpg' })).toMatchObject({ status: 400, data: invalid });
    expect(await upload(env, NOA, imagePart('notes.pdf', 'application/pdf'))).toMatchObject({ status: 400, data: invalid });
    const wrongField = new FormData();
    wrongField.append('photo', { uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg' } as unknown as Blob);
    expect(await upload(env, NOA, wrongField)).toMatchObject({ status: 400, data: invalid });
    expect(await upload(env, null, imagePart('a.jpg', 'image/jpeg'))).toMatchObject({ status: 401 });
    expect(env.server.internals.db.uploads.size).toBe(seeded);
  });

  it('accepts only the caller’s own, unattached upload as the avatar', async () => {
    const env = createTestEnvironment();
    const noa = env.as(NOA);
    const own = await noa.uploads.uploadImage({ uri: 'file:///me.jpg', mimeType: 'image/jpeg', width: null, height: null, fileName: 'me.jpg' });
    await expect(noa.customers.updateCustomerProfile({ avatarUrl: own.url })).resolves.toMatchObject({ user: { avatarUrl: own.url } });
    // The current avatar is a no-op, `null` removes it.
    await expect(noa.customers.updateCustomerProfile({ avatarUrl: own.url })).resolves.toBeDefined();
    await expect(noa.customers.updateCustomerProfile({ avatarUrl: null })).resolves.toMatchObject({ user: { avatarUrl: null } });

    const refused = { status: 400, code: 'VALIDATION_ERROR', fieldErrors: { avatarUrl: ['validation:invalid'] } };
    expect(await expectApiError(noa.customers.updateCustomerProfile({ avatarUrl: 'https://evil.example.com/a.jpg' }))).toMatchObject(refused);
    const avis = await env.as(PRO_IDS.avi).uploads.uploadImage({ uri: 'file:///avi.jpg', mimeType: 'image/jpeg', width: null, height: null, fileName: null });
    expect(await expectApiError(noa.customers.updateCustomerProfile({ avatarUrl: avis.url }))).toMatchObject(refused);
    await expect(env.as(PRO_IDS.avi).professionals.updateProfessionalProfile({ avatarUrl: avis.url })).resolves.toMatchObject({
      avatarUrl: avis.url,
    });
    // A photo already attached to a request is not an avatar.
    const photo = await noa.uploads.uploadImage({ uri: 'file:///sink.jpg', mimeType: 'image/jpeg', width: null, height: null, fileName: null });
    await noa.requests.updateDraftRequest(SEED_IDS.requests.noaDraft, { photoIds: [photo.id] });
    expect(await expectApiError(noa.customers.updateCustomerProfile({ avatarUrl: photo.url }))).toMatchObject(refused);
  });
});
