import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { createCustomer, createUpload } from '../../../../test/factories.js';
import { newObjectId } from '../../../lib/ids.js';
import type { UserDoc } from '../../users/user.model.js';
import { changeAvatar } from '../avatar.service.js';
import { claimUploads, releaseUploads } from '../upload-attachments.service.js';
import { UploadModel } from '../upload.model.js';
import { deleteOrphanUploads, uploadJobs } from '../uploads.jobs.js';

const HOUR = 60 * 60_000;

describe('upload attachments', () => {
  const deps = createTestDeps();
  beforeEach(clearDatabase);

  it('claims only the owner’s unattached uploads, in the given order', async () => {
    const owner = await createCustomer();
    const stranger = await createCustomer();
    const [a, b] = [await createUpload(owner), await createUpload(owner)];
    const attached = await createUpload(owner, { attachedAt: deps.clock.now() });
    const foreign = await createUpload(stranger);

    const claimed = await claimUploads(owner._id, [b._id, a._id, attached._id, foreign._id, newObjectId(), b._id], deps.clock.now());
    expect(claimed.map((upload) => upload._id.toHexString())).toEqual([b._id.toHexString(), a._id.toHexString()]);
    expect(await UploadModel.countDocuments({ attachedAt: null })).toBe(1); // only the stranger's

    await releaseUploads([a._id]);
    expect((await UploadModel.findById(a._id).lean())?.attachedAt).toBeNull();
    expect(await claimUploads(owner._id, [], deps.clock.now())).toEqual([]);
  });

  it('changeAvatar accepts the caller’s own upload and releases the replaced one', async () => {
    const owner = await createCustomer();
    const first = await createUpload(owner);
    const now = deps.clock.now();

    const avatar = await changeAvatar(owner._id, null, first.url, now);
    expect(avatar).toEqual({ url: first.url, publicId: first.publicId });
    expect((await UploadModel.findById(first._id).lean())?.attachedAt).toEqual(now);

    // Unchanged URL: nothing to do.
    expect(await changeAvatar(owner._id, avatar, first.url, now)).toBe(avatar);

    const second = await createUpload(owner);
    const replaced = await changeAvatar(owner._id, avatar, second.url, now);
    expect(replaced?.publicId).toBe(second.publicId);
    expect((await UploadModel.findById(first._id).lean())?.attachedAt).toBeNull();

    expect(await changeAvatar(owner._id, replaced, null, now)).toBeNull();
    expect((await UploadModel.findById(second._id).lean())?.attachedAt).toBeNull();
  });

  it('changeAvatar refuses foreign, attached or unknown URLs and keeps Google pictures', async () => {
    const owner = await createCustomer();
    const stranger = await createCustomer();
    const foreign = await createUpload(stranger);
    const attached = await createUpload(owner, { attachedAt: deps.clock.now() });
    const google: UserDoc['avatar'] = { url: 'https://lh3.googleusercontent.com/a/photo', publicId: null };

    for (const url of [foreign.url, attached.url, 'https://evil.example/pixel.gif']) {
      await expect(changeAvatar(owner._id, google, url, deps.clock.now())).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        fieldErrors: { avatarUrl: ['validation:invalid'] },
      });
    }
    const own = await createUpload(owner);
    expect(await changeAvatar(owner._id, google, own.url, deps.clock.now())).toEqual({ url: own.url, publicId: own.publicId });
  });
});

describe('orphan-uploads cron', () => {
  const deps = createTestDeps({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(async () => {
    await clearDatabase();
    deps.storage.images.clear();
  });

  async function storedUpload(owner: UserDoc, attached: boolean) {
    const image = await deps.storage.upload({ buffer: Buffer.alloc(8), mimeType: 'image/jpeg', folder: 'images' });
    return createUpload(owner, { publicId: image.publicId, url: image.url, attachedAt: attached ? deps.clock.now() : null });
  }

  it('deletes unattached uploads older than 24 h from storage and the database', async () => {
    const owner = await createCustomer();
    const orphan = await storedUpload(owner, false);
    const used = await storedUpload(owner, true);
    deps.clock.advance(23 * HOUR);
    const recent = await storedUpload(owner, false);
    deps.clock.advance(2 * HOUR);

    expect(await deleteOrphanUploads(deps)).toBe(1);
    expect(await UploadModel.exists({ _id: orphan._id })).toBeNull();
    expect(deps.storage.images.has(orphan.publicId)).toBe(false);
    for (const kept of [used, recent]) {
      expect(await UploadModel.exists({ _id: kept._id })).not.toBeNull();
      expect(deps.storage.images.has(kept.publicId)).toBe(true);
    }
    // Idempotent.
    expect(await deleteOrphanUploads(deps)).toBe(0);
  });

  it('works through backlogs in batches and keeps documents when storage fails', async () => {
    const owner = await createCustomer();
    await UploadModel.insertMany(
      Array.from({ length: 150 }, (_, i) => ({ owner: owner._id, publicId: `test/images/bulk-${i}`, url: `https://images.test/bulk-${i}.jpg` })),
    );
    deps.clock.advance(25 * HOUR);
    const failing = {
      ...deps,
      storage: { configured: true, upload: deps.storage.upload.bind(deps.storage), destroy: () => Promise.reject(new Error('down')) },
    };
    await expect(deleteOrphanUploads(failing)).rejects.toThrow('down');
    expect(await UploadModel.countDocuments()).toBe(150);

    expect(await deleteOrphanUploads(deps)).toBe(150);
    expect(await UploadModel.countDocuments()).toBe(0);
  });

  it('is registered daily under its fixed name', () => {
    expect(uploadJobs(deps)).toEqual([expect.objectContaining({ name: 'orphan-uploads', schedule: '17 3 * * *' })]);
  });
});
