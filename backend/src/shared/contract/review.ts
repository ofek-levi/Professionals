import type { CategoryId } from '../catalog/index.js';
import type { Rating } from '../domain.js';
import type { EntityId, ISODateTimeString } from './common.js';

export interface Review {
  id: EntityId;
  jobId: EntityId;
  professionalId: EntityId;
  customerId: EntityId;
  categoryId: CategoryId;
  rating: Rating;
  comment: string | null;
  customerDisplayName: string;
  customerAvatarUrl: string | null;
  createdAt: ISODateTimeString;
}

export interface RatingBreakdown {
  averageRating: number | null;
  reviewCount: number;
  distribution: Record<Rating, number>;
}
