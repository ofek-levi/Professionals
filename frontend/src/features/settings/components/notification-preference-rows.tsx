import { useTranslation } from 'react-i18next';

import { ErrorState, Skeleton, SwitchRow, useToast } from '@/components/ui';
import { makeStyles } from '@/theme';

import { useNotificationPreferences, type NotificationPreferenceKey } from '../use-notification-preferences';
import { EmailVerificationNote } from './email-verification-note';

/**
 * Notification toggles saved on the account (optimistic, rolled back with a toast on failure).
 * Returns one row per preference, to be placed inside a `SettingsSection`; "Email updates" of an
 * unverified address is followed by a note that offers a new verification link.
 */
export function useNotificationPreferenceRows() {
  const styles = useStyles();
  const { t } = useTranslation('settings');
  const toast = useToast();
  const { preferences, email, emailVerified, keys, isLoading, error, refetch, setPreference } = useNotificationPreferences();

  if (!preferences) {
    if (!isLoading && error) return [<ErrorState key="error" compact error={error} onRetry={refetch} />];
    return [0, 1, 2].map((index) => <Skeleton key={index} height={20} width="60%" style={styles.skeleton} />);
  }

  const onToggle = (key: NotificationPreferenceKey, value: boolean) =>
    setPreference(key, value, {
      onError: () => toast.show({ title: t('notifications.saveFailed'), tone: 'danger' }),
      onPushBlocked: () => toast.show({ title: t('notifications.pushBlocked'), tone: 'warning', icon: 'bell-off-outline' }),
    });

  return keys.flatMap((key) => {
    const row = (
      <SwitchRow
        key={key}
        title={t(`notifications.${key}`)}
        value={preferences[key]}
        onValueChange={(value) => onToggle(key, value)}
        testID={`notification-preference-${key}`}
      />
    );
    const needsVerification = key === 'emailEnabled' && emailVerified === false && email !== null;
    return needsVerification ? [row, <EmailVerificationNote key="email-verification" email={email} />] : [row];
  });
}

const useStyles = makeStyles((t) => ({
  skeleton: {
    marginVertical: t.spacing.lg,
  },
}));
