import type {
  CategoryId,
  CurrencyCode,
  NotificationPreferences,
  ProfessionalBusinessInfo,
  ProfessionalContact,
  ServiceArea,
  ServiceLocation,
  WeeklyAvailability,
} from '../domain';
import type { PaginationParams } from './common';

/** `PATCH /professional/profile` */
export interface UpdateProfessionalProfilePayload {
  fullName?: string;
  displayName?: string;
  avatarUrl?: string | null;
  headline?: string;
  bio?: string;
  categoryIds?: CategoryId[];
  yearsOfExperience?: number;
  serviceArea?: ServiceArea;
  baseLocation?: ServiceLocation | null;
  availability?: WeeklyAvailability;
  contact?: ProfessionalContact;
  business?: ProfessionalBusinessInfo;
  startingPrice?: { amount: number; currency: CurrencyCode } | null;
  notificationPreferences?: NotificationPreferences;
}

/** `PATCH /customer/profile` */
export interface UpdateCustomerProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string | null;
  defaultLocation?: ServiceLocation | null;
  notificationPreferences?: NotificationPreferences;
}

/** `GET /professionals/:id/reviews` */
export type ProfessionalReviewsParams = PaginationParams;

/** `GET /professionals` – search/browse (used for "top pros in category"). */
export interface SearchProfessionalsParams extends PaginationParams {
  categoryId?: CategoryId;
  near?: { latitude: number; longitude: number };
}
