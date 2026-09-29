import type {
  Paginated,
  ProfessionalReviewsParams,
  SearchProfessionalsParams,
  UpdateProfessionalProfilePayload,
} from '@/types/api';
import type {
  OwnProfessionalProfile,
  ProfessionalProfile,
  ProfessionalSummary,
  RatingBreakdown,
  Review,
} from '@/types/domain';
import type { ApiClient } from '../client';

const id = (value: string) => encodeURIComponent(value);

export function createProfessionalsApi(client: ApiClient) {
  return {
    /** `GET /professionals/:id` – public profile. */
    getProfessionalProfile: (professionalId: string, signal?: AbortSignal) =>
      client.get<ProfessionalProfile>(`/professionals/${id(professionalId)}`, { signal }),

    /** `GET /professionals/:id/reviews` */
    getProfessionalReviews: (professionalId: string, params: ProfessionalReviewsParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<Review> & { breakdown: RatingBreakdown }>(`/professionals/${id(professionalId)}/reviews`, {
        signal,
        query: { cursor: params.cursor, limit: params.limit },
      }),

    /** `GET /professionals` */
    searchProfessionals: (params: SearchProfessionalsParams = {}, signal?: AbortSignal) =>
      client.get<Paginated<ProfessionalSummary>>('/professionals', {
        signal,
        query: {
          categoryId: params.categoryId,
          lat: params.near?.latitude,
          lng: params.near?.longitude,
          cursor: params.cursor,
          limit: params.limit,
        },
      }),

    /** `GET /professional/profile` – the signed-in professional's own profile. */
    getOwnProfessionalProfile: (signal?: AbortSignal) =>
      client.get<OwnProfessionalProfile>('/professional/profile', { signal }),

    /** `PATCH /professional/profile` */
    updateProfessionalProfile: (payload: UpdateProfessionalProfilePayload) =>
      client.patch<OwnProfessionalProfile>('/professional/profile', payload),
  };
}
