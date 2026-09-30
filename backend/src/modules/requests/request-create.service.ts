/**
 * `POST /requests` – a draft, or published right away (`publish`, the default), with its photos
 * (the multipart files). With a `clientRequestId` a repeated call (a retry after a lost or late
 * response, a double tap) returns the request the first one created, and nothing is uploaded
 * again. Order: that lookup; the rules that need no upload; the photos are stored; the request is
 * created in a transaction. Photos stored for a request that is not created (a failure, or a
 * concurrent post with the same id won) are deleted again, unless the commit may have happened
 * after all (`discardUnsavedPhotos`).
 */
import { Types } from 'mongoose';

import { withTransaction, type Tx } from '../../infra/mongo.js';
import { toLocationDoc } from '../../infra/schema-parts.js';
import { discardImages, storeImages } from '../../infra/storage/store-images.js';
import { isDuplicateKeyError } from '../../lib/errors.js';
import type { AuthContext } from '../../middleware/auth.js';
import { publishInTx, type RequestDeps } from './request-lifecycle.service.js';
import { publishRequestUpdated } from './request-events.js';
import { currentPhotos, discardUnsavedPhotos, publicIdsOf, REQUEST_PHOTOS, toRequestPhotos } from './request-photos.js';
import { assertPreferredSchedule } from './request-rules.js';
import { RequestModel, type RequestDoc, type RequestPhotoDoc } from './request.model.js';
import type { CreateRequestInput } from './requests.schemas.js';

/** The request an earlier `POST /requests` with this `clientRequestId` created, if any. */
function findByClientRequestId(auth: AuthContext, clientRequestId: string | undefined, tx?: Tx): Promise<RequestDoc | null> {
  if (!clientRequestId) return Promise.resolve(null);
  return RequestModel.findOne({ customer: auth.userId, clientRequestId }, null, { session: tx?.session }).lean<RequestDoc>();
}

export async function createRequest(deps: RequestDeps, auth: AuthContext, input: CreateRequestInput, files: readonly Buffer[]): Promise<RequestDoc> {
  const earlier = await findByClientRequestId(auth, input.clientRequestId);
  if (earlier) return earlier;
  assertPreferredSchedule(input.preferredSchedule, input.urgency, deps.clock.now());
  const photos = toRequestPhotos(await storeImages(deps, auth.userId.toHexString(), files, REQUEST_PHOTOS));
  // Chosen here so that after a failed commit the request can be looked up by it.
  const requestId = new Types.ObjectId();
  try {
    const { request, created } = await createRequestOnce(deps, auth, input, { _id: requestId, photos });
    if (!created) await discardImages(deps, publicIdsOf(photos));
    return request;
  } catch (error) {
    await discardUnsavedPhotos(deps, error, photos, () => currentPhotos(requestId));
    if (!isDuplicateKeyError(error)) throw error;
    // A concurrent call with the same clientRequestId committed first: answer with its request.
    const winner = await findByClientRequestId(auth, input.clientRequestId);
    if (!winner) throw error;
    return winner;
  }
}

function createRequestOnce(
  deps: RequestDeps,
  auth: AuthContext,
  input: CreateRequestInput,
  { _id, photos }: { _id: Types.ObjectId; photos: RequestPhotoDoc[] },
): Promise<{ request: RequestDoc; created: boolean }> {
  return withTransaction(deps.logger, async (tx) => {
    const earlier = await findByClientRequestId(auth, input.clientRequestId, tx);
    if (earlier) return { request: earlier, created: false };
    const [doc] = await RequestModel.create(
      [
        {
          _id,
          customer: auth.userId,
          categoryId: input.categoryId,
          description: input.description,
          location: toLocationDoc(input.location),
          urgency: input.urgency,
          preferredSchedule: input.preferredSchedule,
          photos,
          notes: input.notes,
          status: 'draft',
          ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
        },
      ],
      { session: tx.session },
    );
    if (!doc) throw new Error('Request was not created');
    const draft = doc.toObject<RequestDoc>();
    if (input.publish) return { request: await publishInTx(deps, draft, tx), created: true };
    await publishRequestUpdated(deps, draft, { tx });
    return { request: draft, created: true };
  });
}
