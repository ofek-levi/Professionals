import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { Paginated } from '@/types/api';
import type { RatingBreakdown, Review } from '@/types/domain';

import { queryKeys } from './query-keys';
import {
  DEFAULT_PAGE_SIZE,
  getNextPageParam,
  INITIAL_PAGE_PARAM,
  selectPaginatedList,
  useQueryScope,
  type PaginatedInfiniteData,
  type PaginatedList,
} from './query-scope';

/** One page of `GET /professionals/:id/reviews`. */
type ReviewsPage = Paginated<Review> & { breakdown: RatingBreakdown };

interface ReviewsList extends PaginatedList<Review> {
  /** Rating distribution (from the first page). */
  breakdown: RatingBreakdown | null;
}

function selectReviewsList(data: PaginatedInfiniteData<Review> & { pages: ReviewsPage[] }): ReviewsList {
  return { ...selectPaginatedList(data), breakdown: data.pages[0]?.breakdown ?? null };
}

/** `GET /professionals/:id` – public profile. */
export function useProfessionalProfile(professionalId: string | null | undefined) {
  const { userId, enabled } = useQueryScope();
  return useQuery({
    queryKey: queryKeys.professionals.profile(userId, professionalId ?? ''),
    queryFn:
      enabled && professionalId
        ? ({ signal }) => api.professionals.getProfessionalProfile(professionalId, signal)
        : skipToken,
  });
}

/** `GET /professionals/:id/reviews` – infinite, with the rating breakdown. */
export function useProfessionalReviews(professionalId: string | null | undefined, options: { limit?: number } = {}) {
  const { userId, enabled } = useQueryScope();
  const limit = options.limit ?? DEFAULT_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: queryKeys.professionals.reviews(userId, professionalId ?? '', { limit }),
    queryFn: ({ pageParam, signal }): Promise<ReviewsPage> =>
      api.professionals.getProfessionalReviews(professionalId ?? '', { cursor: pageParam, limit }, signal),
    initialPageParam: INITIAL_PAGE_PARAM,
    getNextPageParam,
    select: selectReviewsList,
    enabled: enabled && Boolean(professionalId),
  });
}

/** `GET /professional/profile` – the signed-in professional's own editable profile. */
export function useOwnProfessionalProfile() {
  const { userId, enabled } = useQueryScope('professional');
  return useQuery({
    queryKey: queryKeys.professionals.own(userId),
    queryFn: ({ signal }) => api.professionals.getOwnProfessionalProfile(signal),
    enabled,
  });
}
