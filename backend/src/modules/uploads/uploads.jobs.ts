/**
 * `orphan-uploads` (daily): deletes uploads nobody attached within 24 h — photos picked for a
 * request that was never created, avatars replaced or abandoned — from storage and the database.
 */
import type { AppDeps } from '../../deps.js';
import type { CronJob } from '../../infra/cron/index.js';
import { API_LIMITS } from '../../shared/limits.js';
import { UploadModel, type UploadDoc } from './upload.model.js';

/** Cloudinary deletes at most 100 images per call. */
const BATCH_SIZE = 100;
/** Bounds one run; a backlog larger than this is finished by the next runs. */
const MAX_BATCHES = 100;

type OrphanDeps = Pick<AppDeps, 'storage' | 'clock' | 'logger'>;

/** Returns how many uploads were deleted. */
export async function deleteOrphanUploads(deps: OrphanDeps): Promise<number> {
  const cutoff = new Date(deps.clock.now().getTime() - API_LIMITS.orphanUploadMaxAgeHours * 60 * 60_000);
  const filter = { attachedAt: null, createdAt: { $lt: cutoff } };
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const orphans = await UploadModel.find(filter, { publicId: 1 }).sort({ attachedAt: 1, createdAt: 1 }).limit(BATCH_SIZE).lean<Pick<UploadDoc, '_id' | 'publicId'>[]>();
    if (orphans.length === 0) break;
    // Storage first: when it fails the documents stay and the next run retries.
    await deps.storage.destroy(orphans.map((upload) => upload.publicId));
    const result = await UploadModel.deleteMany({ ...filter, _id: { $in: orphans.map((upload) => upload._id) } });
    deleted += result.deletedCount;
    if (orphans.length < BATCH_SIZE) break;
  }
  if (deleted > 0) deps.logger.info({ deleted }, 'deleted orphan uploads');
  return deleted;
}

export function uploadJobs(deps: OrphanDeps): CronJob[] {
  return [
    {
      name: 'orphan-uploads',
      // 03:17 UTC: a quiet hour in Israel, off the top of the hour.
      schedule: '17 3 * * *',
      lockTtlMs: 30 * 60_000,
      run: async () => {
        await deleteOrphanUploads(deps);
      },
    },
  ];
}
