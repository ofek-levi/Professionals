/**
 * Images travel with their owner, like the backend: `POST /requests` / `PATCH /requests/:id` are
 * multipart (`data` + `photos`), the avatar is `PUT` / `DELETE /me/avatar`.
 */
import type { CreateServiceRequestPayload, LocalImage } from '@/types/api';

import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, type TestEnvironment } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;

const payload = (overrides: Partial<CreateServiceRequestPayload> = {}): CreateServiceRequestPayload => ({
  categoryId: 'plumbing',
  description: 'The bathroom faucet drips constantly and the handle is loose.',
  location: { coordinates: { latitude: 32.0565, longitude: 34.7702 }, addressLine: 'Vital St 5', city: 'Tel Aviv-Yafo', neighborhood: null, details: null },
  urgency: 'normal',
  preferredSchedule: null,
  notes: null,
  publish: true,
  ...overrides,
});

const photo = (name: string, mimeType: string | null = 'image/jpeg'): LocalImage => ({ uri: `file:///photos/${name}`, mimeType, fileName: name });

function multipart(parts: [field: string, value: string | { name: string; type: string }][]): FormData {
  const form = new FormData();
  for (const [field, value] of parts) {
    form.append(field, typeof value === 'string' ? value : ({ uri: `file:///${value.name}`, ...value } as unknown as Blob));
  }
  return form;
}

function send(env: TestEnvironment, method: 'POST' | 'PUT', path: string, body: unknown) {
  return env.transport({ method, path, body, headers: { Authorization: `Bearer ${env.accessTokenFor(NOA)}` } });
}

describe('request photos (multipart)', () => {
  it('sends the payload as `data` and the photos as `photos`, and answers the stored photos', async () => {
    const env = createTestEnvironment();
    const created = await env.as(NOA).requests.createRequest(payload({ notes: 'Gate 4' }), [photo('leak.jpg'), photo('pipe.heic', 'image/heic')]);
    expect(created).toMatchObject({ status: 'open', notes: 'Gate 4' });
    expect(created.photos).toEqual([
      { publicId: expect.stringMatching(/^test\/requests\//), url: expect.stringMatching(/\.jpg$/) },
      { publicId: expect.stringMatching(/^test\/requests\//), url: expect.stringMatching(/\.heic$/) },
    ]);
    const [sent] = env.log.to('/requests', 'POST');
    expect(sent.headers['Content-Type']).toBeUndefined(); // fetch writes the multipart boundary
    const parts = (sent.body as FormData & { getParts(): { fieldName: string; string?: string; name?: string }[] }).getParts();
    expect(parts.map((part) => part.fieldName)).toEqual(['data', 'photos', 'photos']);
    expect(JSON.parse(parts[0].string ?? '')).toMatchObject({ notes: 'Gate 4', publish: true });
  });

  it('answers a retried post (same clientRequestId) with the first request and its photos, storing nothing new', async () => {
    const env = createTestEnvironment();
    const noa = env.as(NOA).requests;
    const form = payload({ clientRequestId: 'creq_retry' });
    const first = await noa.createRequest(form, [photo('leak.jpg')]);
    const retry = await noa.createRequest(form, [photo('leak.jpg')]);
    expect(retry.id).toBe(first.id);
    expect(retry.photos).toEqual(first.photos);
    expect(env.server.internals.db.requests.filter((request) => request.customerId === NOA && request.description === form.description)).toHaveLength(1);
  });

  it('refuses a JSON body, files that are not images, too many photos and files in another field', async () => {
    const env = createTestEnvironment();
    const invalid = (fieldErrors: Record<string, string[]>) => ({ status: 400, data: { code: 'VALIDATION_ERROR', fieldErrors } });
    const data = JSON.stringify(payload());
    expect(await send(env, 'POST', '/requests', payload())).toMatchObject(invalid({ data: ['validation:required'] }));
    expect(await send(env, 'POST', '/requests', multipart([['data', '{']]))).toMatchObject(invalid({ data: ['validation:invalid'] }));
    expect(await send(env, 'POST', '/requests', multipart([['data', data], ['photos', { name: 'a.pdf', type: 'application/pdf' }]]))).toMatchObject(
      invalid({ photos: ['validation:upload.invalid'] }),
    );
    const seven = Array.from({ length: 7 }, (_, i): [string, { name: string; type: string }] => ['photos', { name: `${i}.jpg`, type: 'image/jpeg' }]);
    expect(await send(env, 'POST', '/requests', multipart([['data', data], ...seven]))).toMatchObject(invalid({ photos: ['validation:request.tooManyPhotos'] }));
    expect(await send(env, 'POST', '/requests', multipart([['data', data], ['photo', { name: 'a.jpg', type: 'image/jpeg' }]]))).toMatchObject(
      invalid({ photo: ['validation:upload.invalid'] }),
    );
  });

  it('checks in the backend’s order: the body, the payload and the request’s rules before the file types', async () => {
    const env = createTestEnvironment();
    const pdf = ['photos', { name: 'a.pdf', type: 'application/pdf' }] as [string, { name: string; type: string }];
    // A payload error is the form's (a field), even with a file that is not an image.
    const short = await send(env, 'POST', '/requests', multipart([['data', JSON.stringify(payload({ description: 'short' }))], pdf]));
    expect(short).toMatchObject({ status: 400, data: { fieldErrors: { description: ['validation:request.descriptionTooShort'] } } });
    // An operator key in the payload is refused like the backend's JSON bodies.
    const operator = await send(env, 'POST', '/requests', multipart([['data', JSON.stringify({ ...payload(), location: { $where: 'sleep(1000)' } })]]));
    expect(operator).toMatchObject({ status: 400, data: { fieldErrors: { 'location.$where': ['validation:invalid'] } } });
    // A published request cannot be edited, whatever its files.
    const open = await env.as(NOA).requests.createRequest(payload());
    const edit = await env.transport({
      method: 'PATCH',
      path: `/requests/${open.id}`,
      body: multipart([['data', '{}'], pdf]),
      headers: { Authorization: `Bearer ${env.accessTokenFor(NOA)}` },
    });
    expect(edit.status).toBe(409);
  });

  it('edits a draft’s photos: keeps the listed ones in order and adds the new files after them', async () => {
    const env = createTestEnvironment();
    const noa = env.as(NOA).requests;
    const draft = await noa.createRequest(payload({ publish: false }), [photo('a.jpg'), photo('b.jpg')]);
    const [a, b] = draft.photos;
    const edited = await noa.updateDraftRequest(draft.id, { keepPhotos: [b.publicId] }, [photo('c.png', 'image/png')]);
    expect(edited.photos).toEqual([b, { publicId: expect.any(String), url: expect.stringMatching(/\.png$/) }]);
    expect(edited.photos).not.toContainEqual(a);
    // Without `keepPhotos` the photos stay; an unknown photo is a field error.
    await expect(noa.updateDraftRequest(draft.id, { notes: 'Ring' })).resolves.toMatchObject({ photos: edited.photos, notes: 'Ring' });
    const unknown = await expectApiError(noa.updateDraftRequest(draft.id, { keepPhotos: ['test/requests/nope'] }));
    expect(unknown).toMatchObject({ status: 400, fieldErrors: { keepPhotos: ['validation:request.photoNotFound'] } });
    const tooMany = await expectApiError(noa.updateDraftRequest(draft.id, {}, Array.from({ length: 5 }, (_, i) => photo(`${i}.jpg`))));
    expect(tooMany.fieldErrors).toEqual({ photos: ['validation:request.tooManyPhotos'] });
    // The seeded draft has none of these photos.
    expect((await expectApiError(noa.updateDraftRequest(SEED_IDS.requests.noaDraft, { keepPhotos: [b.publicId] }))).status).toBe(400);
  });
});

describe('avatar', () => {
  it('sets, replaces and removes the avatar; the answer is the current user', async () => {
    const env = createTestEnvironment();
    const users = env.as(NOA).users;
    const first = await users.setAvatar(photo('me.jpg'));
    expect(first.user.avatarUrl).toMatch(/^https:\/\/images\.test\/test\/avatars\/.+\.jpg$/);
    expect(first.customerProfile).not.toBeNull();
    const second = await users.setAvatar(photo('me.png', 'image/png'));
    expect(second.user.avatarUrl).toMatch(/\.png$/);
    expect(second.user.avatarUrl).not.toBe(first.user.avatarUrl);
    await expect(env.as(NOA).customers.getCustomerProfile()).resolves.toMatchObject({ user: { avatarUrl: second.user.avatarUrl } });
    await expect(users.removeAvatar()).resolves.toMatchObject({ user: { avatarUrl: null } });
    // Idempotent.
    await expect(users.removeAvatar()).resolves.toMatchObject({ user: { avatarUrl: null } });
  });

  it('shows a professional’s new photo on their profile', async () => {
    const env = createTestEnvironment();
    const me = await env.as(PRO_IDS.avi).users.setAvatar(photo('avi.jpg'));
    expect(me.professionalProfile?.avatarUrl).toBe(me.user.avatarUrl);
    await expect(env.as(PRO_IDS.avi).professionals.getOwnProfessionalProfile()).resolves.toMatchObject({ avatarUrl: me.user.avatarUrl });
  });

  it('refuses anything but one image in `avatar`', async () => {
    const env = createTestEnvironment();
    const invalid = { status: 400, data: { code: 'VALIDATION_ERROR', fieldErrors: { avatar: ['validation:upload.invalid'] } } };
    expect(await send(env, 'PUT', '/me/avatar', { avatarUrl: 'https://evil.example.com/a.jpg' })).toMatchObject(invalid);
    expect(await send(env, 'PUT', '/me/avatar', multipart([['avatar', { name: 'a.pdf', type: 'application/pdf' }]]))).toMatchObject(invalid);
    expect(await send(env, 'PUT', '/me/avatar', multipart([['note', 'x']]))).toMatchObject(invalid);
    const two = multipart([['avatar', { name: 'a.jpg', type: 'image/jpeg' }], ['avatar', { name: 'b.jpg', type: 'image/jpeg' }]]);
    expect(await send(env, 'PUT', '/me/avatar', two)).toMatchObject(invalid);
    const anonymous = await env.transport({ method: 'PUT', path: '/me/avatar', body: multipart([['avatar', { name: 'a.jpg', type: 'image/jpeg' }]]), headers: {} });
    expect(anonymous.status).toBe(401);
  });
});
