import type { CurrencyCode, EntityId, ISODateTimeString, TimeOfDayString } from './common';
import type { CategoryId } from './category';
import type { ServiceArea, ServiceLocation } from './location';
import type { NotificationPreferences } from './user';

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayAvailability {
  enabled: boolean;
  /** `HH:mm` */
  start: TimeOfDayString;
  /** `HH:mm`, must be after `start`. */
  end: TimeOfDayString;
}

/** Recurring weekly working hours ("appointment availability"). */
export interface WeeklyAvailability {
  days: Record<Weekday, DayAvailability>;
  acceptsEmergencyCalls: boolean;
}

export interface ProfessionalContact {
  phone: string;
  email: string;
  website: string | null;
}

export interface ProfessionalBusinessInfo {
  businessName: string | null;
  licenseNumber: string | null;
  isInsured: boolean;
  /** ISO language codes spoken, e.g. ["he","en","ru"]. */
  languages: string[];
}

export interface ProfessionalStats {
  /** `null` until the first review. 1–5 with one decimal. */
  averageRating: number | null;
  reviewCount: number;
  completedJobsCount: number;
  /** Median minutes to send an offer after a request is published. */
  responseTimeMinutes: number | null;
}

/** Full public profile of a professional. */
export interface ProfessionalProfile {
  id: EntityId;
  userId: EntityId;
  /** Business name when available, otherwise the full name. */
  displayName: string;
  avatarUrl: string | null;
  headline: string;
  bio: string;
  categoryIds: CategoryId[];
  yearsOfExperience: number;
  /** Public views center it on an approximate point near the base (never the exact address). */
  serviceArea: ServiceArea;
  /** Public views carry an approximate location (`isApproximate: true`, no address line). */
  baseLocation: ServiceLocation | null;
  availability: WeeklyAvailability;
  /**
   * Phone and email. In public views only customers who hired the professional (a job with them
   * that was not cancelled) receive it; everyone else gets `null`.
   */
  contact: ProfessionalContact | null;
  business: ProfessionalBusinessInfo;
  stats: ProfessionalStats;
  /** Typical price hint shown on the profile (starting price). */
  startingPrice: { amount: number; currency: CurrencyCode } | null;
  isVerified: boolean;
  memberSince: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/** The professional's own editable profile, including private settings and exact details. */
export interface OwnProfessionalProfile extends ProfessionalProfile {
  /** Full personal name (public views never carry it; customers see `displayName`). */
  fullName: string;
  contact: ProfessionalContact;
  notificationPreferences: NotificationPreferences;
}

/** Compact representation used in lists, offer cards and job headers. */
export interface ProfessionalSummary {
  id: EntityId;
  displayName: string;
  avatarUrl: string | null;
  headline: string;
  categoryIds: CategoryId[];
  yearsOfExperience: number;
  averageRating: number | null;
  reviewCount: number;
  completedJobsCount: number;
  isVerified: boolean;
  city: string;
  /** The professional deleted their account: show "Deleted user" and no profile link (it is gone). */
  accountDeleted?: boolean;
}
