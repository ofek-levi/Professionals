/**
 * Images are stored only where they are used (a request's `photos`, a user's `avatar`), uploaded
 * together with the thing that owns them. `storeImages` checks every file (by its bytes, not by
 * what the client declared) before storing any, charges them to the user's daily bytes
 * (`image-quota.ts`), and removes what it stored when an upload fails. `discardImages` deletes
 * images nothing references any more: callers run it after the commit that dropped them, or when
 * the owner was not saved. It is best effort and never throws: a failure is logged with the public
 * ids, to delete them in the Cloudinary console.
 */
import type { AppDeps } from '../../deps.js';
import { isApiError, type ApiError } from '../../lib/errors.js';
import { imageErrors } from './image-errors.js';
import { chargeImageBytes } from './image-quota.js';
import { detectImageType } from './image-signature.js';
import type { StoredImage } from './image-storage.js';

type ImageDeps = Pick<AppDeps, 'storage' | 'logger'>;
type StoreDeps = ImageDeps & Pick<AppDeps, 'redis' | 'keys'>;

export interface ImageTarget {
  /** Storage sub-folder (`requests`, `avatars`). */
  folder: string;
  /** The multipart field of the files (the field of a 400). */
  field: string;
}

/** 503 for `field`: storage is not configured (`UnconfiguredStorage`) or the provider failed. */
function storageFailure(deps: ImageDeps, reason: unknown, field: string): ApiError {
  if (isApiError(reason)) return imageErrors.unavailable(field, reason.message);
  deps.logger.error({ err: reason }, 'image upload failed');
  return imageErrors.unavailable(field, 'The photos could not be stored, please try again');
}

/** Stores the files of `ownerId` (in order) once all of them are images and within the daily bytes. */
export async function storeImages(deps: StoreDeps, ownerId: string, files: readonly Buffer[], target: ImageTarget): Promise<StoredImage[]> {
  const typed = files.map((buffer) => ({ buffer, mimeType: detectImageType(buffer) }));
  if (typed.some((file) => file.mimeType === null)) {
    throw imageErrors.invalid(target.field, 'Only JPEG, PNG, WebP and HEIC images are accepted');
  }
  await chargeImageBytes(deps, ownerId, target.field, files.reduce((sum, file) => sum + file.length, 0));
  const results = await Promise.allSettled(
    typed.map(({ buffer, mimeType }) => deps.storage.upload({ buffer, mimeType: mimeType ?? 'image/jpeg', folder: target.folder })),
  );
  const stored = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    await discardImages(deps, stored.map((image) => image.publicId));
    throw storageFailure(deps, failed.reason, target.field);
  }
  return stored;
}

export async function discardImages(deps: ImageDeps, publicIds: readonly string[]): Promise<void> {
  if (publicIds.length === 0) return;
  try {
    await deps.storage.destroy([...publicIds]);
  } catch (error) {
    deps.logger.error({ err: error, publicIds }, 'images could not be deleted from storage; delete them there');
  }
}
