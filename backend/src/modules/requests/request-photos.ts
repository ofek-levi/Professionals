/**
 * Request photos are uploaded with the request (`POST /requests`) or with a draft edit
 * (`PATCH /requests/:id`, which lists the current photos to keep) and stored on it as
 * `{ url, publicId }`. An image is deleted from storage once the request no longer shows it: a
 * photo removed from a draft, a deleted draft, a cancelled request (after the commit, best effort).
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { Tx } from '../../infra/mongo.js';
import { discardImages, type ImageTarget } from '../../infra/storage/store-images.js';
import type { StoredImage } from '../../infra/storage/index.js';
import { ApiError, isApiError, isDuplicateKeyError } from '../../lib/errors.js';
import { APP_CONFIG } from '../../shared/limits.js';
import { MULTIPART_FIELDS } from '../../shared/multipart-fields.js';
import { vm } from '../../shared/validation-messages.js';
import { RequestModel, type RequestDoc, type RequestPhotoDoc } from './request.model.js';

/** Where request photos are stored, and the multipart field they arrive in. */
export const REQUEST_PHOTOS: ImageTarget = { folder: 'requests', field: MULTIPART_FIELDS.requestPhotos };

export function toRequestPhotos(images: readonly StoredImage[]): RequestPhotoDoc[] {
  return images.map(({ url, publicId }) => ({ url, publicId }));
}

export function publicIdsOf(photos: readonly RequestPhotoDoc[]): string[] {
  return photos.map((photo) => photo.publicId);
}

/**
 * The draft photos a `PATCH` keeps: `keep` lists public ids of its current photos, in the new order
 * (`undefined` keeps them all). An id the draft does not have → 400 `keepPhotos`.
 */
export function keptPhotos(current: readonly RequestPhotoDoc[], keep: readonly string[] | undefined): RequestPhotoDoc[] {
  if (keep === undefined) return [...current];
  const byId = new Map(current.map((photo) => [photo.publicId, photo]));
  return [...new Set(keep)].map((publicId) => {
    const photo = byId.get(publicId);
    if (!photo) throw ApiError.validation({ keepPhotos: [vm('request.photoNotFound')] }, `The request has no photo "${publicId}"`);
    return photo;
  });
}

export function assertPhotoCount(count: number): void {
  if (count > APP_CONFIG.maxRequestPhotos) {
    throw ApiError.validation({ photos: [vm('request.tooManyPhotos')] }, `A request has at most ${APP_CONFIG.maxRequestPhotos} photos`);
  }
}

/** Public ids of `before` that `after` no longer has. */
export function removedPhotoIds(before: readonly RequestPhotoDoc[], after: readonly RequestPhotoDoc[]): string[] {
  const kept = new Set(publicIdsOf(after));
  return publicIdsOf(before).filter((publicId) => !kept.has(publicId));
}

/** Deletes the images from storage once `tx` committed (in the background: the response does not wait). */
export function discardAfterCommit(deps: Pick<AppDeps, 'storage' | 'logger' | 'background'>, tx: Tx, publicIds: readonly string[]): void {
  if (publicIds.length === 0) return;
  tx.afterCommit(() => deps.background.run('discard-request-photos', () => discardImages(deps, publicIds)));
}

/**
 * Deletes the photos stored for a save that failed with `error`. An `ApiError` or a duplicate key
 * aborted the transaction, so nothing shows them. After any other error the commit may still have
 * happened (the driver gave up retrying an unknown commit result, a connection dropped at commit),
 * so the request is read again (`shown`) and only the photos it does not show are deleted; when it
 * cannot be read, they are kept and logged.
 */
export async function discardUnsavedPhotos(
  deps: Pick<AppDeps, 'storage' | 'logger'>,
  error: unknown,
  stored: readonly RequestPhotoDoc[],
  shown: () => Promise<readonly RequestPhotoDoc[] | null>,
): Promise<void> {
  const ids = publicIdsOf(stored);
  if (ids.length === 0) return;
  if (isApiError(error) || isDuplicateKeyError(error)) {
    await discardImages(deps, ids);
    return;
  }
  let kept: Set<string>;
  try {
    kept = new Set(publicIdsOf((await shown()) ?? []));
  } catch (readError) {
    deps.logger.error({ err: readError, publicIds: ids }, 'photos of a failed save were kept: the request could not be read again');
    return;
  }
  await discardImages(deps, ids.filter((publicId) => !kept.has(publicId)));
}

/** The photos request `requestId` shows now (`null` when it does not exist). */
export async function currentPhotos(requestId: Types.ObjectId): Promise<RequestPhotoDoc[] | null> {
  const request = await RequestModel.findById(requestId, { photos: 1 }).lean<Pick<RequestDoc, 'photos'>>();
  return request?.photos ?? null;
}
