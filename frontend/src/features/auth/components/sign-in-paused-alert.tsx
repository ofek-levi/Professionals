/**
 * Shown on the sign-in screen after too many failed attempts (429): sign-in is paused for this
 * account from here, also with the right password, until the server's window ends (`Retry-After`).
 * Says when, and offers the way in right now: a password reset lifts the pause.
 */
import { useTranslation } from 'react-i18next';

import { InlineAlert } from '@/components/ui';

interface SignInPausedAlertProps {
  /** From the 429's `Retry-After` (`null` when the server did not say). */
  retryAfterSeconds: number | null;
  onResetPassword: () => void;
}

export function SignInPausedAlert({ retryAfterSeconds, onResetPassword }: SignInPausedAlertProps) {
  const { t } = useTranslation('auth');
  const minutes = retryAfterSeconds === null ? null : Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return (
    <InlineAlert
      tone="warning"
      title={t('login.paused.title')}
      message={minutes === null ? t('login.paused.messageSoon') : t('login.paused.message', { count: minutes })}
      actionLabel={t('login.paused.resetPassword')}
      onAction={onResetPassword}
      testID="login-paused"
    />
  );
}
