/** `/professionals/*` routes (public profiles, reviews, browse). */
import { CATEGORY_IDS } from '@/constants/professional-categories';
import { isWithinServiceArea } from '@/features/requests/request-matching';
import { bayesianRating } from '@/features/reviews/rating';
import { DomainError } from '@/features/shared/domain-error';
import { vm } from '@/lib/validation/messages';
import { haversineDistanceKm, isValidCoordinates } from '@/utils/geo';

import { paginate } from '../pagination';
import { requireProfessional } from '../queries';
import { route } from '../router';
import { listProfessionalReviews } from '../services/review-service';
import { toProfessionalSummary, toPublicProfessionalProfile } from '../views';
import { paginationFrom } from './shared';

export const professionalsRoutes = [
  route({
    method: 'GET',
    path: '/professionals',
    auth: 'user',
    handler: ({ ctx, query }) => {
      const categoryId = query.enumValue('categoryId', CATEGORY_IDS);
      const lat = query.number('lat');
      const lng = query.number('lng');
      const near = lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;
      if (near && !isValidCoordinates(near)) throw DomainError.validation({ lat: [vm('location.coordinatesInvalid')] });
      const professionals = ctx.db.professionals
        .filter(
          (professional) =>
            (!categoryId || (professional.categoryIds as readonly string[]).includes(categoryId)) &&
            (!near || isWithinServiceArea(professional.serviceArea, near)),
        )
        .map((professional) => ({
          professional,
          score: bayesianRating(professional.stats.averageRating, professional.stats.reviewCount),
          distance: near ? haversineDistanceKm(professional.serviceArea.center, near) : 0,
        }))
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.professional.stats.reviewCount - a.professional.stats.reviewCount ||
            a.distance - b.distance ||
            a.professional.id.localeCompare(b.professional.id),
        )
        .map(({ professional }) => toProfessionalSummary(professional));
      return paginate(professionals, paginationFrom(query));
    },
  }),
  route({
    method: 'GET',
    path: '/professionals/:professionalId',
    auth: 'user',
    handler: ({ ctx, params, actor }) => toPublicProfessionalProfile(ctx, requireProfessional(ctx.db, params.professionalId), actor),
  }),
  route({
    method: 'GET',
    path: '/professionals/:professionalId/reviews',
    auth: 'user',
    handler: ({ ctx, params, query }) => listProfessionalReviews(ctx, params.professionalId, paginationFrom(query)),
  }),
];
