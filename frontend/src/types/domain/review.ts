import type { EntityId, ISODateTimeString } from './common';
import type { CategoryId } from './category';

export const RATING_VALUES = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof RATING_VALUES)[number];

export interface Review {
  id: EntityId;
  jobId: EntityId;
  professionalId: EntityId;
  customerId: EntityId;
  categoryId: CategoryId;
  rating: Rating;
  comment: string | null;
  /** Display info of the reviewer, denormalized by the backend. */
  customerDisplayName: string;
  customerAvatarUrl: string | null;
  /** The reviewer deleted their account: show "Deleted user" (the comment was removed). */
  customerAccountDeleted?: boolean;
  createdAt: ISODateTimeString;
}

export interface RatingBreakdown {
  averageRating: number | null;
  reviewCount: number;
  /** Count per star value. */
  distribution: Record<Rating, number>;
}
