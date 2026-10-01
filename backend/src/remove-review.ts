/**
 * Removes one review (a court order, a review that breaks the Terms): the review is deleted, its job
 * can be reviewed again, and the professional's rating is recounted from the remaining reviews
 * (`review-removal.service.ts`). See OPERATIONS.md §9. The review id is in `GET /v1/professionals/:id/reviews`
 * (`items[].id`), in a job's `reviewId`, or in the `reviews` collection.
 *
 *   npm run remove-review -- 66f0c2a1b4e5d6f708192a3b        (reads .env)
 *   node dist/remove-review.js 66f0c2a1b4e5d6f708192a3b      (in the image, with the environment's variables)
 */
import { Types } from 'mongoose';

import { isObjectIdString } from './lib/ids.js';
import { removeReview } from './modules/reviews/review-removal.service.js';
import { commandLine, runOperatorCommand, usageError } from './operator-command.js';

const USAGE = 'remove-review <review id>';

const [id = ''] = commandLine(USAGE, { required: 1 }).args;
if (!isObjectIdString(id)) usageError(USAGE, 'A review id is 24 hexadecimal characters.');
const reviewId = new Types.ObjectId(id);

runOperatorCommand('remove-review', async (deps) => {
  const removed = await removeReview(deps, reviewId);
  if (!removed) {
    process.stderr.write(`No review ${reviewId.toHexString()} (or it was removed already).\n`);
    return 1;
  }
  const professionalId = removed.professional.toHexString();
  process.stdout.write(`Removed the ${removed.rating}★ review ${reviewId.toHexString()} of professional ${professionalId}; their rating was recounted.\n`);
  return 0;
});
