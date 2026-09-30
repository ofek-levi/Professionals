/**
 * Image files for the multipart routes (the API checks the first bytes, so a few are enough) and
 * a helper that sends a request's JSON payload (`data`) and photos (`photos`) the way the app does.
 */
import type { Test } from 'supertest';

export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
export const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
export const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
export const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj');

/** `data` = the JSON payload, then one `photos` file per buffer. */
export function withForm(test: Test, data: unknown, photos: readonly Buffer[] = []): Test {
  let form = test.field('data', JSON.stringify(data));
  photos.forEach((photo, index) => {
    form = form.attach('photos', photo, { filename: `photo-${index + 1}.jpg`, contentType: 'image/jpeg' });
  });
  return form;
}
