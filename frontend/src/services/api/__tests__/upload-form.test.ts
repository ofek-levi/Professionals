/**
 * The multipart body of `POST /uploads/images`: one `file` part, streamed from the device on
 * iOS/Android, read into a Blob on the web; through the uploads endpoint, sent as FormData with the
 * long upload time limit.
 */
import { Platform } from 'react-native';

import type { UploadImagePayload } from '@/types/api';

import { ApiClient } from '../client';
import { createUploadsApi } from '../endpoints/uploads';
import type { TransportRequest } from '../transport';
import { buildImageFormData, uploadFileName } from '../upload-form';

interface NativePart {
  fieldName: string;
  uri?: string;
  name?: string;
  type?: string;
}

const partsOf = (form: FormData) => (form as unknown as { getParts(): NativePart[] }).getParts();

const payload = (overrides: Partial<UploadImagePayload> = {}): UploadImagePayload => ({
  uri: 'file:///var/mobile/photos/IMG_0001.HEIC',
  mimeType: 'image/heic',
  width: 3024,
  height: 4032,
  fileName: 'IMG_0001.HEIC',
  ...overrides,
});

function onPlatform(os: typeof Platform.OS) {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  return () => Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
}

describe('upload form', () => {
  it('names the file after the picker, or photo.<ext> by its type', () => {
    expect(uploadFileName({ fileName: 'leak.jpg', mimeType: 'image/jpeg' })).toBe('leak.jpg');
    expect(uploadFileName({ fileName: '  ', mimeType: 'image/png' })).toBe('photo.png');
    expect(uploadFileName({ fileName: null, mimeType: 'image/webp' })).toBe('photo.webp');
    expect(uploadFileName({ fileName: null, mimeType: 'image/heif' })).toBe('photo.heif');
    expect(uploadFileName({ fileName: null, mimeType: null })).toBe('photo.jpg');
    expect(uploadFileName({ fileName: null, mimeType: 'image/gif' })).toBe('photo.jpg');
  });

  it('streams the picked file from the device on iOS/Android ({ uri, name, type } in `file`)', async () => {
    const form = await buildImageFormData(payload());
    expect(partsOf(form)).toEqual([
      expect.objectContaining({ fieldName: 'file', uri: 'file:///var/mobile/photos/IMG_0001.HEIC', name: 'IMG_0001.HEIC', type: 'image/heic' }),
    ]);
    const unnamed = await buildImageFormData(payload({ fileName: null, mimeType: null }));
    expect(partsOf(unnamed)[0]).toMatchObject({ name: 'photo.jpg', type: 'image/jpeg' });
    // Only the file: dimensions and the local uri never travel as JSON fields.
    expect(partsOf(form).map((part) => part.fieldName)).toEqual(['file']);
  });

  it('reads the picked image into a Blob on the web', async () => {
    const restore = onPlatform('web');
    const blob = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const realFetch = global.fetch;
    const fetchMock = jest.fn(async () => new Response(blob));
    global.fetch = fetchMock as unknown as typeof fetch;
    const append = jest.spyOn(FormData.prototype, 'append');
    try {
      await buildImageFormData(payload({ uri: 'blob:http://localhost:8081/1234', mimeType: 'image/png', fileName: null }));
      expect(fetchMock).toHaveBeenCalledWith('blob:http://localhost:8081/1234');
      expect(append).toHaveBeenCalledTimes(1);
      const [field, value, name] = append.mock.calls[0] as unknown as [string, Blob, string];
      expect(field).toBe('file');
      expect(value).toBeInstanceOf(Blob);
      expect(value.size).toBe(blob.size);
      expect(name).toBe('photo.png');
    } finally {
      append.mockRestore();
      global.fetch = realFetch;
      restore();
    }
  });

  it('posts the FormData to /uploads/images with the 90 s upload limit', async () => {
    const sent: TransportRequest[] = [];
    const client = new ApiClient({
      transport: async (request) => {
        sent.push(request);
        return { status: 201, data: { id: 'upl_1', url: 'https://images.test/upl_1.heic', width: 1600, height: 1200 } };
      },
      auth: { getAccessToken: () => 'token' },
    });
    await expect(createUploadsApi(client).uploadImage(payload())).resolves.toMatchObject({ id: 'upl_1' });
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/uploads/images', timeoutMs: 90_000 });
    expect(sent[0].body).toBeInstanceOf(FormData);
    expect(partsOf(sent[0].body as FormData)[0]).toMatchObject({ fieldName: 'file', type: 'image/heic' });
  });
});
