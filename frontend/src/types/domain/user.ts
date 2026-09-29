import type { AppLanguage, EntityId, ISODateTimeString, LocalizedText } from './common';
import type { SavedLocation, ServiceLocation } from './location';

export const USER_ROLES = ['customer', 'professional'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: EntityId;
  role: UserRole;
  firstName: string;
  lastName: string;
  /** Name shown to other users (business name for professionals). */
  displayName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  preferredLanguage: AppLanguage | null;
  createdAt: ISODateTimeString;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  /** Offers, acceptances, cancellations. */
  jobUpdates: boolean;
  messages: boolean;
  /** Professional only: new matching requests. */
  newRequests: boolean;
  reminders: boolean;
}

export interface CustomerProfile {
  userId: EntityId;
  defaultLocation: ServiceLocation | null;
  savedLocations: SavedLocation[];
  notificationPreferences: NotificationPreferences;
  stats: {
    requestsCount: number;
    completedJobsCount: number;
  };
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

/** Demo accounts are the mock replacement for real registration/login. */
export interface DemoAccount {
  userId: EntityId;
  role: UserRole;
  displayName: string;
  avatarUrl: string | null;
  /** Short explanation of what can be tested with the account (product copy, so localized). */
  description: LocalizedText;
  /** Category ids for professionals, empty for customers. */
  categoryIds: string[];
  city: string;
}
