/**
 * Customer request lifecycle after creation (`request-create.service.ts`): publish, edit/delete
 * drafts. Publishing notifies every matching professional and tells their explorers
 * (`request.updated`), in the background after the commit, then stores how many professionals it
 * matched (the customer sees it). Publishing is idempotent, so the app can retry after a lost or
 * late response.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { toLocationDoc, type LocationDoc } from '../../infra/schema-parts.js';
import { storeImages } from '../../infra/storage/store-images.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { createNotifications } from '../notifications/create-notification.service.js';
import { findMatchingProfessionals } from './matching.service.js';
import { customerNameOf, loadOwnedRequest } from './request-access.js';
import { publishExplorerChange, publishRequestUpdated } from './request-events.js';
import {
  assertPhotoCount,
  currentPhotos,
  discardAfterCommit,
  discardUnsavedPhotos,
  keptPhotos,
  publicIdsOf,
  removedPhotoIds,
  REQUEST_PHOTOS,
  toRequestPhotos,
} from './request-photos.js';
import { assertPreferredSchedule, assertRequestTransition } from './request-rules.js';
import { RequestModel, requestPublicPoint, type RequestDoc, type RequestPhotoDoc } from './request.model.js';
import type { UpdateDraftRequestInput } from './requests.schemas.js';

export type RequestDeps = Pick<AppDeps, 'env' | 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background' | 'storage'>;

/**
 * Draft → open. After the commit, in the background (category and location never change, and the
 * fan-out can be large): the matching professionals are computed, notified and their explorers
 * refreshed (`request.updated`), so neither the transaction nor the response waits for them.
 */
export async function publishInTx(deps: RequestDeps, request: RequestDoc, tx: Tx): Promise<RequestDoc> {
  const now = deps.clock.now();
  assertRequestTransition(request.status, 'open');
  assertPreferredSchedule(request.preferredSchedule, request.urgency, now);
  const published = await RequestModel.findOneAndUpdate(
    { _id: request._id, status: request.status },
    { $set: { status: 'open', publishedAt: now } },
    { session: tx.session, returnDocument: 'after' },
  ).lean<RequestDoc>();
  if (!published) throw ApiError.invalidTransition('request', request.status, 'open');
  tx.afterCommit(() => deps.background.run('request-published-fan-out', () => announcePublished(deps, published)));
  return published;
}

async function announcePublished(deps: RequestDeps, published: RequestDoc): Promise<void> {
  const [matches, customerName] = await Promise.all([findMatchingProfessionals(published), customerNameOf(published.customer)]);
  await createNotifications(
    deps,
    matches.map((match) => ({
      userId: match.professionalId,
      input: { type: 'new_matching_request', request: published, customerName, distanceKm: match.distanceKm },
    })),
  );
  await publishExplorerChange(deps, published, matches.map((match) => match.professionalId));
  // The customer's request page says how many were notified (or that none cover the area yet).
  await RequestModel.updateOne({ _id: published._id }, { $set: { matchedProfessionalCount: matches.length } });
  await publishRequestUpdated(deps, published);
}

/** `POST /requests/:id/publish` – idempotent: an already published (open) request is returned as is. */
export function publishRequest(deps: RequestDeps, auth: AuthContext, requestId: Types.ObjectId): Promise<RequestDoc> {
  return withTransaction(deps.logger, async (tx) => {
    const request = await loadOwnedRequest(auth, requestId, tx.session);
    return request.status === 'open' ? request : publishInTx(deps, request, tx);
  });
}

/** A new exact location and its approximate pin, which must always move together. */
function relocate(location: LocationDoc, requestId: Types.ObjectId): Pick<RequestDoc, 'location' | 'publicPoint'> {
  return { location, publicPoint: requestPublicPoint(location, requestId) };
}

/**
 * The rules of a draft edit (checked before the upload, so a refused edit stores nothing, and again
 * in the transaction); returns the photos it keeps.
 */
function checkDraftEdit(request: RequestDoc, input: UpdateDraftRequestInput, addedPhotos: number, now: Date): RequestPhotoDoc[] {
  if (request.status !== 'draft') throw ApiError.conflict('Only drafts can be edited');
  if (input.preferredSchedule !== undefined || input.urgency !== undefined) {
    assertPreferredSchedule(input.preferredSchedule !== undefined ? input.preferredSchedule : request.preferredSchedule, input.urgency ?? request.urgency, now);
  }
  const kept = keptPhotos(request.photos, input.keepPhotos);
  assertPhotoCount(kept.length + addedPhotos);
  return kept;
}

/**
 * `PATCH /requests/:id` – drafts only; the preferred date is re-checked against the (new) urgency.
 * Photos: the kept ones (`keepPhotos`), then the new files; removed ones are deleted from storage.
 */
export async function updateDraftRequest(
  deps: RequestDeps,
  auth: AuthContext,
  requestId: Types.ObjectId,
  input: UpdateDraftRequestInput,
  files: readonly Buffer[],
): Promise<RequestDoc> {
  const now = deps.clock.now();
  checkDraftEdit(await loadOwnedRequest(auth, requestId), input, files.length, now);
  const added = toRequestPhotos(await storeImages(deps, auth.userId.toHexString(), files, REQUEST_PHOTOS));
  try {
    return await withTransaction(deps.logger, async (tx) => {
      const request = await loadOwnedRequest(auth, requestId, tx.session);
      const kept = checkDraftEdit(request, input, added.length, now);
      const photos = input.keepPhotos === undefined && added.length === 0 ? undefined : [...kept, ...added];
      const updated = await RequestModel.findOneAndUpdate(
        { _id: request._id, status: 'draft' },
        {
          $set: {
            ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.location !== undefined ? relocate(toLocationDoc(input.location), request._id) : {}),
            ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
            ...(input.preferredSchedule !== undefined ? { preferredSchedule: input.preferredSchedule } : {}),
            ...(photos !== undefined ? { photos } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
          },
        },
        { session: tx.session, returnDocument: 'after' },
      ).lean<RequestDoc>();
      if (!updated) throw ApiError.conflict('Only drafts can be edited');
      if (photos) discardAfterCommit(deps, tx, removedPhotoIds(request.photos, photos));
      await publishRequestUpdated(deps, updated, { tx });
      return updated;
    });
  } catch (error) {
    await discardUnsavedPhotos(deps, error, added, () => currentPhotos(requestId));
    throw error;
  }
}

/** `DELETE /requests/:id` – drafts only; their photos are deleted from storage after the commit. */
export function deleteDraftRequest(deps: RequestDeps, auth: AuthContext, requestId: Types.ObjectId): Promise<void> {
  return withTransaction(deps.logger, async (tx) => {
    const request = await loadOwnedRequest(auth, requestId, tx.session);
    if (request.status !== 'draft') throw ApiError.conflict('Only drafts can be deleted');
    const result = await RequestModel.deleteOne({ _id: request._id, status: 'draft' }, { session: tx.session });
    if (result.deletedCount === 0) throw ApiError.conflict('Only drafts can be deleted');
    discardAfterCommit(deps, tx, publicIdsOf(request.photos));
    await publishEvent(deps.realtime, [auth.userId], { type: 'request.updated', requestId: request._id.toHexString() }, tx);
  });
}
