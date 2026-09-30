/**
 * Upload quotas, on top of the per-user request rate. Images cost storage and bandwidth at the
 * provider, accounts are free, and an image nobody attaches stays stored for up to 24 h, so:
 * - at most `pendingUploadsPerUser` unattached uploads per user (a request takes 6 photos; an
 *   upload stops counting once a request or profile uses it, or when the orphan cron deletes it);
 * - at most `uploadBytesPerUserPerDay` uploaded per user per 24 h window.
 * Both are checked before the file is read (no buffering for a refused caller); the bytes are
 * charged once the file is in memory. Concurrent uploads may overshoot by a file or two, which the
 * per-user rate limit bounds. A Redis failure lets uploads through.
 */
import type { NextFunction, Request, Response } from 'express';

import type { AppDeps } from '../../deps.js';
import { fixedWindowTotal, hitFixedWindow } from '../../infra/fixed-window.js';
import { KEY_SPACES } from '../../infra/keys.js';
import { ApiError } from '../../lib/errors.js';
import { authOf } from '../../middleware/auth.js';
import { UploadModel, UNATTACHED } from './upload.model.js';

export const UPLOAD_QUOTAS = {
  pendingUploadsPerUser: 20,
  uploadBytesPerUserPerDay: 200 * 1024 * 1024,
  windowMs: 24 * 60 * 60_000,
} as const;

type QuotaDeps = Pick<AppDeps, 'redis' | 'keys' | 'logger'>;

function bytesKey(deps: QuotaDeps, userId: string): string {
  return deps.keys.key(KEY_SPACES.rateLimit, 'upload-bytes', userId);
}

async function uploadedBytes(deps: QuotaDeps, userId: string): Promise<number> {
  try {
    return await fixedWindowTotal(deps.redis, bytesKey(deps, userId));
  } catch (error) {
    deps.logger.warn({ err: error }, 'upload byte quota unavailable');
    return 0;
  }
}

/** Middleware (after `requireAuth`, before multer): 429 when a quota is used up. */
export const checkUploadQuota = (deps: QuotaDeps) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const owner = authOf(req).userId;
    const [pending, bytes] = await Promise.all([
      UploadModel.countDocuments({ owner, attachedAt: UNATTACHED }),
      uploadedBytes(deps, owner.toHexString()),
    ]);
    if (pending >= UPLOAD_QUOTAS.pendingUploadsPerUser) {
      throw ApiError.rateLimited('Too many images waiting to be used: add them to a request or try again tomorrow');
    }
    if (bytes >= UPLOAD_QUOTAS.uploadBytesPerUserPerDay) throw ApiError.rateLimited('Daily upload limit reached, please try again tomorrow');
    next();
  } catch (error) {
    next(error);
  }
};

/** Counts an accepted file towards the caller's daily bytes. */
export async function chargeUploadBytes(deps: QuotaDeps, userId: string, bytes: number): Promise<void> {
  try {
    await hitFixedWindow(deps.redis, bytesKey(deps, userId), UPLOAD_QUOTAS.windowMs, bytes);
  } catch (error) {
    deps.logger.warn({ err: error }, 'upload byte quota unavailable');
  }
}
