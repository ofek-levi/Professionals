import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { useUpdateCustomerProfile, useUpdateProfessionalProfile } from '@/hooks/mutations/use-profile-mutations';
import type { NotificationPreferences, UserRole } from '@/types/domain';

export type NotificationPreferenceKey = keyof NotificationPreferences;

/** Toggles shown per role, in display order (`newRequests` only matters to professionals). */
const NOTIFICATION_PREFERENCE_KEYS: Record<UserRole, readonly NotificationPreferenceKey[]> = {
  customer: ['pushEnabled', 'jobUpdates', 'messages', 'reminders', 'emailEnabled'],
  professional: ['pushEnabled', 'newRequests', 'jobUpdates', 'messages', 'reminders', 'emailEnabled'],
};

interface NotificationPreferencesState {
  preferences: NotificationPreferences | null;
  keys: readonly NotificationPreferenceKey[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** Saves one toggle (optimistic; rolls back and calls `onError` on failure). */
  setPreference: (key: NotificationPreferenceKey, value: boolean, onError?: (error: unknown) => void) => void;
}

/**
 * The signed-in user's notification preferences, stored on their role profile
 * (`PATCH /customer/profile` or `PATCH /professional/profile`).
 */
export function useNotificationPreferences(): NotificationPreferencesState {
  const currentUser = useCurrentUser();
  const updateCustomer = useUpdateCustomerProfile();
  const updateProfessional = useUpdateProfessionalProfile();

  const data = currentUser.data;
  const role = data?.user.role ?? null;
  const preferences = data?.customerProfile?.notificationPreferences ?? data?.professionalProfile?.notificationPreferences ?? null;

  const setPreference: NotificationPreferencesState['setPreference'] = (key, value, onError) => {
    if (!preferences || !role) return;
    const payload = { notificationPreferences: { ...preferences, [key]: value } };
    if (role === 'customer') updateCustomer.mutate(payload, { onError });
    else updateProfessional.mutate(payload, { onError });
  };

  return {
    preferences,
    keys: role ? NOTIFICATION_PREFERENCE_KEYS[role] : [],
    isLoading: currentUser.isPending,
    error: currentUser.error,
    refetch: () => {
      void currentUser.refetch();
    },
    setPreference,
  };
}
