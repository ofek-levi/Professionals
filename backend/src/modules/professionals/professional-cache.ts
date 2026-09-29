/**
 * Short Redis cache of the public professional profile (the most read profile view: offer lists
 * and request details link to it). Only the viewer-independent public view is cached — contact
 * details are added per viewer. Whoever changes a field the profile shows calls
 * `invalidatePublicProfessionalProfile` (profile edits here; stats in reviews/jobs/offers); the
 * TTL bounds staleness otherwise.
 */
import type { Types } from 'mongoose';

import type { AppDeps } from '../../deps.js';
import type { ProfessionalProfile } from '../../shared/contract/index.js';
import { API_LIMITS } from '../../shared/limits.js';

const cacheKey = (professionalId: Types.ObjectId) => `professional:public:${professionalId.toHexString()}`;

export function cachedPublicProfile(
  deps: Pick<AppDeps, 'cache'>,
  professionalId: Types.ObjectId,
  load: () => Promise<ProfessionalProfile | null>,
): Promise<ProfessionalProfile | null> {
  return deps.cache.wrap(cacheKey(professionalId), API_LIMITS.publicProfileCacheTtlSeconds, load);
}

export async function invalidatePublicProfessionalProfile(deps: Pick<AppDeps, 'cache'>, professionalId: Types.ObjectId): Promise<void> {
  await deps.cache.del(cacheKey(professionalId));
}
