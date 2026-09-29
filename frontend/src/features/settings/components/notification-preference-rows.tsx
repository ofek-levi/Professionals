import { useTranslation } from 'react-i18next';

import { ErrorState, Skeleton, SwitchRow, useToast } from '@/components/ui';
import { makeStyles } from '@/theme';

import { useNotificationPreferences, type NotificationPreferenceKey } from '../use-notification-preferences';

/**
 * Notification toggles saved on the account (optimistic, rolled back with a toast on failure).
 * Returns one row per preference, to be placed inside a `SettingsSection`.
 */
export function useNotificationPreferenceRows() {
  const styles = useStyles();
  const { t } = useTranslation('settings');
  const toast = useToast();
  const { preferences, keys, isLoading, error, refetch, setPreference } = useNotificationPreferences();

  if (!preferences) {
    if (!isLoading && error) return [<ErrorState key="error" compact error={error} onRetry={refetch} />];
    return [0, 1, 2].map((index) => <Skeleton key={index} height={20} width="60%" style={styles.skeleton} />);
  }

  const onToggle = (key: NotificationPreferenceKey, value: boolean) =>
    setPreference(key, value, () => toast.show({ title: t('notifications.saveFailed'), tone: 'danger' }));

  return keys.map((key) => (
    <SwitchRow
      key={key}
      title={t(`notifications.${key}`)}
      value={preferences[key]}
      onValueChange={(value) => onToggle(key, value)}
      testID={`notification-preference-${key}`}
    />
  ));
}

const useStyles = makeStyles((t) => ({
  skeleton: {
    marginVertical: t.spacing.lg,
  },
}));
