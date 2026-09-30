import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { useUpdateCustomerProfile, useUpdateProfessionalProfile } from '@/hooks/mutations/use-profile-mutations';
import { pushProvider, pushRegistration } from '@/services/push';
import type { NotificationPreferences, UserRole } from '@/types/domain';

export type NotificationPreferenceKey = keyof NotificationPreferences;

/** Toggles shown per role, in display order (`newRequests` only matters to professionals). */
const NOTIFICATION_PREFERENCE_KEYS: Record<UserRole, readonly NotificationPreferenceKey[]> = {
  customer: ['pushEnabled', 'jobUpdates', 'messages', 'reminders', 'emailEnabled'],
  professional: ['pushEnabled', 'newRequests', 'jobUpdates', 'messages', 'reminders', 'emailEnabled'],
};

interface NotificationPreferencesState {
  preferences: NotificationPreferences | null;
  /** The sign-in address, and whether it is verified (email updates only reach verified ones). */
  email: string | null;
  emailVerified: boolean | null;
  keys: readonly NotificationPreferenceKey[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** Saves one toggle (optimistic; rolls back and calls `onError` on failure). */
  setPreference: (key: NotificationPreferenceKey, value: boolean, callbacks?: PreferenceCallbacks) => void;
}

interface PreferenceCallbacks {
  onError?: (error: unknown) => void;
  /** Push was turned on but the OS blocks notifications for the app (phone settings). */
  onPushBlocked?: () => void;
}

/**
 * Turning push off also removes this device from the account (`DELETE /me/devices/:token`);
 * turning it on registers it again (`PushNotifications`, which asks for permission if needed).
 */
async function applyPushToggle(enabled: boolean, onPushBlocked?: () => void): Promise<void> {
  if (!pushProvider.isSupported) return;
  if (!enabled) {
    await pushRegistration.unregister();
    return;
  }
  if ((await pushProvider.getPermissionStatus()) === 'denied') onPushBlocked?.();
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

  const setPreference: NotificationPreferencesState['setPreference'] = (key, value, callbacks = {}) => {
    if (!preferences || !role) return;
    const payload = { notificationPreferences: { ...preferences, [key]: value } };
    const options = { onError: callbacks.onError };
    if (role === 'customer') updateCustomer.mutate(payload, options);
    else updateProfessional.mutate(payload, options);
    if (key === 'pushEnabled') void applyPushToggle(value, callbacks.onPushBlocked);
  };

  return {
    preferences,
    email: data?.user.email ?? null,
    emailVerified: data?.emailVerified ?? null,
    keys: role ? NOTIFICATION_PREFERENCE_KEYS[role] : [],
    isLoading: currentUser.isPending,
    error: currentUser.error,
    refetch: () => {
      void currentUser.refetch();
    },
    setPreference,
  };
}
