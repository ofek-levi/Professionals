/**
 * Under "Email updates" while the sign-in address is not verified: those emails only go to verified
 * addresses (the sign-up link expires after 48 h), so it says so and sends a new link.
 */
import { useTranslation } from 'react-i18next';

import { InlineAlert, useErrorToast, useToast } from '@/components/ui';
import { useResendVerificationEmail } from '@/hooks';
import { isolateText } from '@/utils/bidi';

export function EmailVerificationNote({ email }: { email: string }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const showError = useErrorToast();
  const resend = useResendVerificationEmail();
  const address = isolateText(email);

  const sendLink = () => {
    if (resend.isPending) return;
    resend.mutate(undefined, {
      onSuccess: () => toast.show({ title: t('notifications.verifyEmail.sent', { email: address }), tone: 'success' }),
      onError: (error) => showError(error),
    });
  };

  return (
    <InlineAlert
      tone="warning"
      message={t('notifications.verifyEmail.message', { email: address })}
      actionLabel={t('notifications.verifyEmail.resend')}
      onAction={sendLink}
      testID="email-verification-note"
    />
  );
}
