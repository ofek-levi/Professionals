/**
 * Customer request lifecycle (the mock's `lifecycle-service.ts`, requests part): create (draft or
 * published), edit/delete drafts, publish. Publishing notifies every matching professional and
 * tells their explorers (`request.updated`), in the background after the commit.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import { withTransaction, type Tx } from '../../infra/mongo.js';
import { publishEvent } from '../../infra/realtime/index.js';
import { toLocationDoc, type LocationDoc } from '../../infra/schema-parts.js';
import { ApiError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { createNotifications } from '../notifications/create-notification.service.js';
import { releaseUploads } from '../uploads/upload-attachments.service.js';
import { findMatchingProfessionals } from './matching.service.js';
import { customerNameOf, loadOwnedRequest } from './request-access.js';
import { publishExplorerChange, publishRequestUpdated } from './request-events.js';
import { releaseRemovedPhotos, resolveRequestPhotos } from './request-photos.js';
import { assertPreferredSchedule, assertRequestTransition } from './request-rules.js';
import { RequestModel, requestPublicPoint, type RequestDoc } from './request.model.js';
import type { CreateRequestInput, UpdateDraftRequestInput } from './requests.schemas.js';

type RequestDeps = Pick<AppDeps, 'env' | 'logger' | 'clock' | 'realtime' | 'push' | 'mailer' | 'redis' | 'keys' | 'background'>;

/**
 * Draft → open. After the commit, in the background (category and location never change, and the
 * fan-out can be large): the matching professionals are computed, notified and their explorers
 * refreshed (`request.updated`), so neither the transaction nor the response waits for them.
 */
async function publishInTx(deps: RequestDeps, request: RequestDoc, tx: Tx): Promise<RequestDoc> {
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
}

/** `POST /requests` – a draft, or published right away (`publish`, the default). */
export function createRequest(deps: RequestDeps, auth: AuthContext, input: CreateRequestInput): Promise<RequestDoc> {
  const now = deps.clock.now();
  assertPreferredSchedule(input.preferredSchedule, input.urgency, now);
  return withTransaction(deps.logger, async (tx) => {
    const photos = await resolveRequestPhotos(auth.userId, input.photoIds, [], now, tx.session);
    const [created] = await RequestModel.create(
      [
        {
          customer: auth.userId,
          categoryId: input.categoryId,
          description: input.description,
          location: toLocationDoc(input.location),
          urgency: input.urgency,
          preferredSchedule: input.preferredSchedule,
          photos,
          notes: input.notes,
          status: 'draft',
        },
      ],
      { session: tx.session },
    );
    if (!created) throw new Error('Request was not created');
    const draft = created.toObject<RequestDoc>();
    if (input.publish) return publishInTx(deps, draft, tx);
    await publishRequestUpdated(deps, draft, { tx });
    return draft;
  });
}

/** `POST /requests/:id/publish` */
export function publishRequest(deps: RequestDeps, auth: AuthContext, requestId: Types.ObjectId): Promise<RequestDoc> {
  return withTransaction(deps.logger, async (tx) => publishInTx(deps, await loadOwnedRequest(auth, requestId, tx.session), tx));
}

/** A new exact location and its approximate pin, which must always move together. */
function relocate(location: LocationDoc, requestId: Types.ObjectId): Pick<RequestDoc, 'location' | 'publicPoint'> {
  return { location, publicPoint: requestPublicPoint(location, requestId) };
}

/** `PATCH /requests/:id` – drafts only; the preferred date is re-checked against the (new) urgency. */
export function updateDraftRequest(deps: RequestDeps, auth: AuthContext, requestId: Types.ObjectId, input: UpdateDraftRequestInput): Promise<RequestDoc> {
  const now = deps.clock.now();
  return withTransaction(deps.logger, async (tx) => {
    const request = await loadOwnedRequest(auth, requestId, tx.session);
    if (request.status !== 'draft') throw ApiError.conflict('Only drafts can be edited');
    if (input.preferredSchedule !== undefined || input.urgency !== undefined) {
      assertPreferredSchedule(input.preferredSchedule !== undefined ? input.preferredSchedule : request.preferredSchedule, input.urgency ?? request.urgency, now);
    }
    const photos = input.photoIds === undefined ? undefined : await resolveRequestPhotos(auth.userId, input.photoIds, request.photos, now, tx.session);
    if (photos) await releaseRemovedPhotos(request.photos, photos, tx.session);
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
    await publishRequestUpdated(deps, updated, { tx });
    return updated;
  });
}

/** `DELETE /requests/:id` – drafts only; their photos are released for the orphan cleanup. */
export function deleteDraftRequest(deps: RequestDeps, auth: AuthContext, requestId: Types.ObjectId): Promise<void> {
  return withTransaction(deps.logger, async (tx) => {
    const request = await loadOwnedRequest(auth, requestId, tx.session);
    if (request.status !== 'draft') throw ApiError.conflict('Only drafts can be deleted');
    const result = await RequestModel.deleteOne({ _id: request._id, status: 'draft' }, { session: tx.session });
    if (result.deletedCount === 0) throw ApiError.conflict('Only drafts can be deleted');
    await releaseUploads(request.photos.map((photo) => photo.upload), tx.session);
    await publishEvent(deps.realtime, [auth.userId], { type: 'request.updated', requestId: request._id.toHexString() }, tx);
  });
}
