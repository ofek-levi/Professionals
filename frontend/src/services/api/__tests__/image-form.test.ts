/**
 * Multipart bodies of the routes that take images: the request payload as the text field `data`
 * first, then the images (`photos` / `avatar`), streamed from the device on iOS/Android and read
 * into a Blob on the web; sent through the endpoints with a time limit per image.
 */
import { Platform } from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';
import type { CreateServiceRequestPayload, LocalImage } from '@/types/api';

import { ApiClient } from '../client';
import { createRequestsApi } from '../endpoints/requests';
import { createUsersApi } from '../endpoints/users';
import { ApiError } from '../errors';
import { buildImageForm, imageFileName } from '../image-form';
import * as shrinkImage from '../shrink-image';
import type { TransportRequest } from '../transport';

interface NativePart {
  fieldName: string;
  uri?: string;
  name?: string;
  type?: string;
  string?: string;
}

const partsOf = (form: FormData) => (form as unknown as { getParts(): NativePart[] }).getParts();

const image = (overrides: Partial<LocalImage> = {}): LocalImage => ({
  uri: 'file:///var/mobile/photos/IMG_0001.HEIC',
  mimeType: 'image/heic',
  fileName: 'IMG_0001.HEIC',
  ...overrides,
});

function onPlatform(os: typeof Platform.OS) {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return () => Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
}

function recordingClient(data: unknown) {
  const sent: TransportRequest[] = [];
  const client = new ApiClient({
    transport: async (request) => {
      sent.push(request);
      return { status: request.method === 'POST' ? 201 : 200, data };
    },
    auth: { getAccessToken: () => 'token' },
  });
  return { client, sent };
}

describe('image form', () => {
  it('names the file after the picker, or photo.<ext> by its type', () => {
    expect(imageFileName({ fileName: 'leak.jpg', mimeType: 'image/jpeg' })).toBe('leak.jpg');
    expect(imageFileName({ fileName: '  ', mimeType: 'image/png' })).toBe('photo.png');
    expect(imageFileName({ fileName: null, mimeType: 'image/webp' })).toBe('photo.webp');
    expect(imageFileName({ fileName: null, mimeType: 'image/heif' })).toBe('photo.heif');
    expect(imageFileName({ fileName: null, mimeType: null })).toBe('photo.jpg');
    expect(imageFileName({ fileName: null, mimeType: 'image/gif' })).toBe('photo.jpg');
  });

  it('puts the JSON payload first, then streams each picked file from the device on iOS/Android', async () => {
    const form = await buildImageForm({ data: { description: 'Leak' }, field: 'photos', images: [image(), image({ fileName: null, mimeType: null, uri: 'file:///b' })] });
    expect(partsOf(form)).toEqual([
      expect.objectContaining({ fieldName: 'data', string: '{"description":"Leak"}' }),
      expect.objectContaining({ fieldName: 'photos', uri: 'file:///var/mobile/photos/IMG_0001.HEIC', name: 'IMG_0001.HEIC', type: 'image/heic' }),
      expect.objectContaining({ fieldName: 'photos', uri: 'file:///b', name: 'photo.jpg', type: 'image/jpeg' }),
    ]);
    // The avatar has no payload: only its file.
    const avatar = await buildImageForm({ field: 'avatar', images: [image()] });
    expect(partsOf(avatar).map((part) => part.fieldName)).toEqual(['avatar']);
  });

  it('reads the picked image into a Blob on the web', async () => {
    const restore = onPlatform('web');
    const blob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const realFetch = global.fetch;
    const fetchMock = jest.fn(async () => new Response(blob));
    global.fetch = fetchMock as unknown as typeof fetch;
    const append = jest.spyOn(FormData.prototype, 'append');
    try {
      await buildImageForm({ field: 'avatar', images: [image({ uri: 'blob:http://localhost:8081/1234', mimeType: 'image/png', fileName: null })] });
      expect(fetchMock).toHaveBeenCalledWith('blob:http://localhost:8081/1234');
      expect(append).toHaveBeenCalledTimes(1);
      const [field, value, name] = append.mock.calls[0] as unknown as [string, Blob, string];
      expect(field).toBe('avatar');
      expect(value).toBeInstanceOf(Blob);
      expect(value.size).toBe(blob.size);
      expect(name).toBe('photo.png');
    } finally {
      append.mockRestore();
      global.fetch = realFetch;
      restore();
    }
  });

  it('refuses a photo over the upload limit before sending it (iOS/Android report its size), as the server would', async () => {
    const tooLarge = image({ fileSize: APP_CONFIG.maxUploadBytes + 1 });
    const error = await buildImageForm({ data: {}, field: 'photos', images: [image(), tooLarge] }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 413, code: 'VALIDATION_ERROR', fieldErrors: { photos: ['validation:upload.invalid'] } });
    await expect(buildImageForm({ field: 'avatar', images: [tooLarge] })).rejects.toMatchObject({ fieldErrors: { avatar: ['validation:upload.invalid'] } });
    await expect(buildImageForm({ field: 'photos', images: [image({ fileSize: APP_CONFIG.maxUploadBytes })] })).resolves.toBeInstanceOf(FormData);
  });

  it('re-encodes a web photo over the limit as a smaller JPEG, or refuses it when the browser cannot', async () => {
    const restore = onPlatform('web');
    const big = new Blob([new Uint8Array(APP_CONFIG.maxUploadBytes + 10)], { type: 'image/png' });
    const small = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
    const realFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response(big)) as unknown as typeof fetch;
    const shrink = jest.spyOn(shrinkImage, 'shrinkImageBlob').mockResolvedValueOnce(small).mockResolvedValueOnce(null);
    const append = jest.spyOn(FormData.prototype, 'append');
    try {
      await buildImageForm({ field: 'photos', images: [image({ uri: 'blob:http://localhost:8081/big', mimeType: 'image/png', fileName: 'camera.png' })] });
      expect(shrink).toHaveBeenCalledWith(expect.any(Blob), APP_CONFIG.maxUploadBytes);
      const [field, value, name] = append.mock.calls[0] as unknown as [string, Blob, string];
      expect([field, value, name]).toEqual(['photos', small, 'camera.jpg']);

      const refused = await buildImageForm({ field: 'photos', images: [image({ uri: 'blob:http://localhost:8081/big' })] }).catch((caught: unknown) => caught);
      expect(refused).toMatchObject({ status: 413, code: 'VALIDATION_ERROR' });
    } finally {
      append.mockRestore();
      shrink.mockRestore();
      global.fetch = realFetch;
      restore();
    }
  });
});

describe('endpoints that send images', () => {
  const payload = { categoryId: 'plumbing', description: 'Water under the sink', publish: true, clientRequestId: 'creq_1' } as unknown as CreateServiceRequestPayload;

  it('POST /requests sends one multipart body: the payload and the photos, 90 s per photo', async () => {
    const { client, sent } = recordingClient({ id: 'req_1' });
    const api = createRequestsApi(client);
    await api.createRequest(payload, [image(), image({ uri: 'file:///2.jpg', fileName: '2.jpg', mimeType: 'image/jpeg' })]);
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/requests', timeoutMs: 180_000 });
    const parts = partsOf(sent[0].body as FormData);
    expect(parts.map((part) => part.fieldName)).toEqual(['data', 'photos', 'photos']);
    expect(JSON.parse(parts[0].string ?? '')).toEqual(payload);

    // Without photos: still multipart (the payload alone), the client's default time limit.
    await api.createRequest(payload);
    expect(sent[1].timeoutMs).toBeUndefined();
    expect(partsOf(sent[1].body as FormData).map((part) => part.fieldName)).toEqual(['data']);
  });

  it('PATCH /requests/:id sends the kept photos in the payload and the new ones as files', async () => {
    const { client, sent } = recordingClient({ id: 'req 1' });
    await createRequestsApi(client).updateDraftRequest('req 1', { keepPhotos: ['test/requests/a'] }, [image()]);
    expect(sent[0]).toMatchObject({ method: 'PATCH', path: '/requests/req%201' });
    const parts = partsOf(sent[0].body as FormData);
    expect(parts.map((part) => [part.fieldName, part.string ?? part.uri])).toEqual([
      ['data', '{"keepPhotos":["test/requests/a"]}'],
      ['photos', 'file:///var/mobile/photos/IMG_0001.HEIC'],
    ]);
  });

  it('PUT /me/avatar sends the image as `avatar`; DELETE /me/avatar removes it', async () => {
    const { client, sent } = recordingClient({ user: { avatarUrl: null } });
    const users = createUsersApi(client);
    await users.setAvatar(image());
    expect(sent[0]).toMatchObject({ method: 'PUT', path: '/me/avatar', timeoutMs: 90_000 });
    expect(partsOf(sent[0].body as FormData)).toEqual([expect.objectContaining({ fieldName: 'avatar', type: 'image/heic' })]);
    await users.removeAvatar();
    expect(sent[1]).toMatchObject({ method: 'DELETE', path: '/me/avatar', body: undefined });
  });
});
