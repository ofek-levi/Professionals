import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { parseObjectId } from '../../lib/ids.js';
import { validateRequest } from '../../lib/validate.js';
import { authOf } from '../../middleware/auth.js';
import { getOwnProfessionalProfile, updateOwnProfessionalProfile } from './own-profile.service.js';
import { listProfessionalReviews } from './professional-reviews.service.js';
import { searchProfessionals } from './professional-search.service.js';
import { professionalParams, professionalReviewsQuery, searchProfessionalsQuery, updateProfessionalProfileBody } from './professionals.schemas.js';
import { getPublicProfessionalProfile } from './public-profile.service.js';

/** `GET /v1/professional/profile` → `OwnProfessionalProfile` */
export const getOwnProfile = () => (req: Request) => getOwnProfessionalProfile(authOf(req, 'professional'));

/** `PATCH /v1/professional/profile` → `OwnProfessionalProfile` */
export const updateOwnProfile = (deps: AppDeps) => (req: Request) => {
  const { body } = validateRequest(req, { body: updateProfessionalProfileBody });
  return updateOwnProfessionalProfile(deps, authOf(req, 'professional'), body);
};

/** `GET /v1/professionals?categoryId=&lat=&lng=&cursor=&limit=` → `Paginated<ProfessionalSummary>` */
export const search = () => (req: Request) => {
  const { query } = validateRequest(req, { query: searchProfessionalsQuery });
  return searchProfessionals(query);
};

/** `GET /v1/professionals/:professionalId` → `ProfessionalProfile` (viewer-dependent privacy) */
export const getPublicProfile = (deps: AppDeps) => (req: Request) => {
  const { params } = validateRequest(req, { params: professionalParams });
  return getPublicProfessionalProfile(deps, authOf(req), parseObjectId(params.professionalId, 'Professional'));
};

/** `GET /v1/professionals/:professionalId/reviews` → `Paginated<Review> & { breakdown }` */
export const listReviews = () => (req: Request) => {
  const { params, query } = validateRequest(req, { params: professionalParams, query: professionalReviewsQuery });
  return listProfessionalReviews(parseObjectId(params.professionalId, 'Professional'), { cursor: query.cursor, limit: query.limit });
};
