import type { CustomerProfile, NotificationPreferences, ServiceLocation } from '@/types/domain';

import type { StoredUser } from '../server/db';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: false,
  jobUpdates: true,
  messages: true,
  newRequests: true,
  reminders: true,
};

type UserInput = Pick<StoredUser, 'id' | 'role' | 'firstName' | 'lastName' | 'createdAt'> & Partial<StoredUser>;

/** Builds a user row. `displayName` defaults to the full name. */
export function createUser(input: UserInput): StoredUser {
  return {
    displayName: `${input.firstName} ${input.lastName}`,
    email: `${input.firstName}.${input.lastName}@example.com`.toLowerCase().replace(/\s+/g, ''),
    phone: '050-000-0000',
    avatarUrl: null,
    preferredLanguage: null,
    isDemo: false,
    demoDescription: null,
    ...input,
  };
}

type CustomerProfileInput = Pick<CustomerProfile, 'userId' | 'updatedAt'> & {
  defaultLocation?: ServiceLocation | null;
} & Partial<CustomerProfile>;

export function createCustomerProfile(input: CustomerProfileInput): CustomerProfile {
  return {
    defaultLocation: null,
    savedLocations: input.defaultLocation
      ? [{ id: `loc_${input.userId}_home`, label: 'Home', location: input.defaultLocation }]
      : [],
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    stats: { requestsCount: 0, completedJobsCount: 0 },
    ...input,
  };
}
