import type { CategoryId } from '../catalog/index.js';
import type { CurrencyCode, Weekday } from '../domain.js';
import type { EntityId, ISODateTimeString, TimeOfDayString } from './common.js';
import type { ServiceArea, ServiceLocation } from './location.js';
import type { NotificationPreferences } from './user.js';

export interface DayAvailability {
  enabled: boolean;
  start: TimeOfDayString;
  end: TimeOfDayString;
}

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
  languages: string[];
}

export interface ProfessionalStats {
  averageRating: number | null;
  reviewCount: number;
  completedJobsCount: number;
  responseTimeMinutes: number | null;
}

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface ProfessionalProfile {
  id: EntityId;
  userId: EntityId;
  fullName: string;
  displayName: string;
  avatarUrl: string | null;
  headline: string;
  bio: string;
  categoryIds: CategoryId[];
  yearsOfExperience: number;
  /** Public views center it on an approximate point. */
  serviceArea: ServiceArea;
  /** Public views carry an approximate location. */
  baseLocation: ServiceLocation | null;
  availability: WeeklyAvailability;
  /** `null` in public views unless the viewer hired the professional. */
  contact: ProfessionalContact | null;
  business: ProfessionalBusinessInfo;
  stats: ProfessionalStats;
  startingPrice: Money | null;
  isVerified: boolean;
  memberSince: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface OwnProfessionalProfile extends ProfessionalProfile {
  contact: ProfessionalContact;
  notificationPreferences: NotificationPreferences;
}

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
}
