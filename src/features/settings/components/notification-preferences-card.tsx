import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { Divider, ErrorState, Skeleton, SwitchRow, useToast, type IconName } from '@/components/ui';
import { makeStyles } from '@/theme';

import { useNotificationPreferences, type NotificationPreferenceKey } from '../use-notification-preferences';

const PREFERENCE_ICONS: Record<NotificationPreferenceKey, IconName> = {
  pushEnabled: 'bell-ring-outline',
  jobUpdates: 'briefcase-outline',
  newRequests: 'map-marker-radius-outline',
  messages: 'message-text-outline',
  reminders: 'calendar-clock',
  emailEnabled: 'email-outline',
};

/** Notification toggles saved on the account (optimistic, rolled back with a toast on failure). */
export function NotificationPreferencesCard() {
  const styles = useStyles();
  const { t } = useTranslation('settings');
  const toast = useToast();
  const { preferences, keys, isLoading, error, refetch, setPreference } = useNotificationPreferences();

  if (!preferences) {
    if (!isLoading && error) return <ErrorState compact error={error} onRetry={refetch} />;
    return (
      <>
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={44} style={styles.skeleton} />
        ))}
      </>
    );
  }

  const onToggle = (key: NotificationPreferenceKey, value: boolean) =>
    setPreference(key, value, () => toast.show({ title: t('notifications.saveFailed'), tone: 'danger' }));

  return (
    <>
      {keys.map((key, index) => (
        <Fragment key={key}>
          {index > 0 ? <Divider inset={48} /> : null}
          <SwitchRow
            icon={PREFERENCE_ICONS[key]}
            iconTone={key === 'pushEnabled' ? 'brand' : 'neutral'}
            title={t(`notifications.${key}.title`)}
            description={t(`notifications.${key}.description`)}
            value={preferences[key]}
            onValueChange={(value) => onToggle(key, value)}
            testID={`notification-preference-${key}`}
          />
        </Fragment>
      ))}
    </>
  );
}

const useStyles = makeStyles((t) => ({
  skeleton: {
    marginVertical: t.spacing.sm,
  },
}));
