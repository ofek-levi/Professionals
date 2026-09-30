import { describe, expect, it, vi } from 'vitest';

import { TEST_REDIS_PREFIX, testRedis } from '../../../test/context.js';
import { HEIC, JPEG, PDF, PNG, WEBP } from '../../../test/images.js';
import { createSilentLogger } from '../../lib/logger.js';
import { API_LIMITS } from '../../shared/limits.js';
import { fixedWindowTotal, hitFixedWindow } from '../fixed-window.js';
import { createRedisKeys } from '../keys.js';
import { imageBytesKey } from '../storage/image-quota.js';
import { detectImageType } from '../storage/image-signature.js';
import { MemoryImageStorage } from '../storage/memory-storage.js';
import { discardImages, storeImages } from '../storage/store-images.js';
import { UnconfiguredStorage } from '../storage/unconfigured-storage.js';

const TARGET = { folder: 'requests', field: 'photos' };
const DAY_MS = 24 * 60 * 60_000;
let owners = 0;
/** A user nobody else in this file charges. */
const owner = () => `owner-${(owners += 1)}`;

function deps<S extends MemoryImageStorage | UnconfiguredStorage = MemoryImageStorage>(storage?: S) {
  return { storage: storage ?? new MemoryImageStorage(), logger: createSilentLogger(), redis: testRedis(), keys: createRedisKeys(TEST_REDIS_PREFIX) };
}

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

describe('storeImages / discardImages', () => {
  it('stores every image in the folder with the type read from its bytes', async () => {
    const d = deps();
    const upload = vi.spyOn(d.storage, 'upload');
    const images = await storeImages(d, owner(), [JPEG, PNG], TARGET);
    expect(images.map((image) => image.publicId)).toEqual([...d.storage.images.keys()]);
    expect(upload.mock.calls.map(([input]) => [input.folder, input.mimeType])).toEqual([
      ['requests', 'image/jpeg'],
      ['requests', 'image/png'],
    ]);
    expect(await storeImages(d, owner(), [], TARGET)).toEqual([]);
  });

  it('stores nothing when one file is not an image', async () => {
    const d = deps();
    const who = owner();
    await expect(storeImages(d, who, [JPEG, PDF], TARGET)).rejects.toMatchObject({ status: 400, fieldErrors: { photos: ['validation:upload.invalid'] } });
    expect(d.storage.images.size).toBe(0);
    // Refused files are not charged.
    expect(await fixedWindowTotal(d.redis, imageBytesKey(d, who))).toBe(0);
  });

  it('removes the stored ones when an upload fails (503 naming the field; an unconfigured storage keeps its message)', async () => {
    const d = deps();
    const upload = d.storage.upload.bind(d.storage);
    vi.spyOn(d.storage, 'upload').mockImplementationOnce(upload).mockRejectedValueOnce(new Error('timeout')).mockImplementationOnce(upload);
    await expect(storeImages(d, owner(), [JPEG, PNG, WEBP], TARGET)).rejects.toMatchObject({
      status: 503,
      code: 'SERVER_ERROR',
      fieldErrors: { photos: ['validation:upload.unavailable'] },
    });
    expect(d.storage.images.size).toBe(0);
    await expect(storeImages(deps(new UnconfiguredStorage()), owner(), [JPEG], { folder: 'avatars', field: 'avatar' })).rejects.toMatchObject({
      status: 503,
      message: 'Image uploads are not configured on this server',
      fieldErrors: { avatar: ['validation:upload.unavailable'] },
    });
  });

  it('charges the bytes to the owner’s day; a post past the daily limit is refused and not charged', async () => {
    const d = deps();
    const [who, other] = [owner(), owner()];
    await storeImages(d, who, [JPEG, PNG], TARGET);
    expect(await fixedWindowTotal(d.redis, imageBytesKey(d, who))).toBe(JPEG.length + PNG.length);

    // 100 bytes left today: two photos (108 bytes) are too many, one (68 bytes) still fits.
    await hitFixedWindow(d.redis, imageBytesKey(d, who), DAY_MS, API_LIMITS.imageBytesPerUserPerDay - 100 - JPEG.length - PNG.length);
    const upload = vi.spyOn(d.storage, 'upload');
    const refused = await storeImages(d, who, [JPEG, PNG], TARGET).catch((error: unknown) => error);
    expect(refused).toMatchObject({ status: 429, code: 'RATE_LIMITED', fieldErrors: { photos: ['validation:upload.rateLimited'] } });
    expect((refused as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(DAY_MS / 1000 - 60);
    expect(upload).not.toHaveBeenCalled();
    expect(await fixedWindowTotal(d.redis, imageBytesKey(d, who))).toBe(API_LIMITS.imageBytesPerUserPerDay - 100);
    await storeImages(d, who, [JPEG], TARGET);
    await storeImages(d, other, [JPEG, PNG], TARGET);
    expect(upload).toHaveBeenCalledTimes(3);
  });

  it('lets posts through when the quota cannot be read (Redis down)', async () => {
    const d = deps();
    vi.spyOn(d.redis, 'eval').mockRejectedValueOnce(new Error('Redis down'));
    await expect(storeImages(d, owner(), [JPEG], TARGET)).resolves.toHaveLength(1);
  });

  it('discarding never throws; a storage failure is logged with the ids', async () => {
    const d = deps();
    const [image] = await storeImages(d, owner(), [JPEG], TARGET);
    await discardImages(d, [image?.publicId ?? '']);
    expect(d.storage.images.size).toBe(0);
    vi.spyOn(d.storage, 'destroy').mockRejectedValueOnce(new Error('Cloudinary down'));
    const error = vi.spyOn(d.logger, 'error');
    await expect(discardImages(d, ['test/requests/x'])).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ publicIds: ['test/requests/x'] }), expect.any(String));
    await discardImages(d, []);
  });
});
