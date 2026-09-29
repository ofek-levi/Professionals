import type { AppLanguage, UserRole } from '../domain.js';
import type { EntityId, ISODateTimeString } from './common.js';
import type { SavedLocation, ServiceLocation } from './location.js';

export interface User {
  id: EntityId;
  role: UserRole;
  firstName: string;
  lastName: string;
  /** Business name for professionals (when set), otherwise the full name. */
  displayName: string;
  /** Sign-in email. */
  email: string;
  phone: string;
  avatarUrl: string | null;
  preferredLanguage: AppLanguage | null;
  createdAt: ISODateTimeString;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  jobUpdates: boolean;
  messages: boolean;
  newRequests: boolean;
  reminders: boolean;
}

export interface CustomerProfile {
  userId: EntityId;
  defaultLocation: ServiceLocation | null;
  savedLocations: SavedLocation[];
  notificationPreferences: NotificationPreferences;
  stats: { requestsCount: number; completedJobsCount: number };
  updatedAt: ISODateTimeString;
}

/** Minimal public info about a customer that professionals may see. */
export interface CustomerSummary {
  id: EntityId;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  memberSince: ISODateTimeString;
  completedJobsCount: number;
}
