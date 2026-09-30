import type {
  CategoryId,
  CurrencyCode,
  CustomerProfile,
  NotificationPreferences,
  ProfessionalBusinessInfo,
  ProfessionalContact,
  ServiceArea,
  ServiceLocation,
  User,
  WeeklyAvailability,
} from '../domain';
import type { PaginationParams } from './common';

/** `PATCH /professional/profile` (the avatar has its own endpoint: `PUT`/`DELETE /me/avatar`). */
export interface UpdateProfessionalProfilePayload {
  fullName?: string;
  displayName?: string;
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

/** `GET` and `PATCH /customer/profile` */
export interface CustomerProfileResponse {
  user: User;
  profile: CustomerProfile;
}

/** `PATCH /customer/profile` (the avatar has its own endpoint: `PUT`/`DELETE /me/avatar`). */
export interface UpdateCustomerProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
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
