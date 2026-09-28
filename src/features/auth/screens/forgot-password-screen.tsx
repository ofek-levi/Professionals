/**
 * `/auth/forgot-password` – asks for the account email (prefilled with the one typed on the sign-in
 * screen) and requests a reset link. The answer never reveals whether an account exists: the
 * success state reads "If an account exists for …". With the mock backend nothing is sent, and the
 * success state says so.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormTextField } from '@/components/forms';
import { AppText, Button, Icon, Screen, useErrorToast } from '@/components/ui';
import { useDemoTools } from '@/features/settings/use-demo-tools';
import { useRequestPasswordReset } from '@/hooks';
import { routes } from '@/lib/routes';
import { forgotPasswordSchema, toPasswordResetRequest, type ForgotPasswordFormValues } from '@/lib/validation/auth';
import { toApiError } from '@/services/api/errors';
import { makeStyles, useTheme } from '@/theme';
import { isolateText } from '@/utils/bidi';

import { authEmailHint, useAuthEmailHint } from '../auth-email-hint';
import { AuthIntro } from '../components/auth-intro';
import { useSingleFlight } from '../use-single-flight';

type ForgotPasswordFormOutput = z.output<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('auth');
  const showError = useErrorToast();
  const resetPassword = useRequestPasswordReset();
  const { isAvailable: demo } = useDemoTools();
  const flight = useSingleFlight();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues, unknown, ForgotPasswordFormOutput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });
  // The email typed on the sign-in screen, if any.
  useAuthEmailHint((email) => form.reset({ email }));

  const submit = () =>
    flight.run(
      form.handleSubmit(async (values) => {
        const payload = toPasswordResetRequest(values);
        try {
          await resetPassword.mutateAsync(payload);
          if (flight.isMounted()) setSentTo(payload.email);
        } catch (error) {
          if (!flight.isMounted()) return;
          const message = toApiError(error).fieldErrors?.email?.[0];
          if (message) form.setError('email', { type: 'server', message });
          else showError(error);
        }
      }),
    );

  // Back to the sign-in screen it was opened from (or to it, when opened directly), with the email
  // the link went to and a fresh password field.
  const backToSignIn = () => {
    if (sentTo) authEmailHint.set(sentTo);
    router.dismissTo(routes.auth.login);
  };

  if (sentTo) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID="forgot-password-sent">
        <View style={styles.sent}>
          <SentIcon />
          <View style={styles.sentTexts} accessibilityLiveRegion="polite">
            <AppText variant="title" align="center" accessibilityRole="header">
              {t('forgotPassword.sentTitle')}
            </AppText>
            <AppText variant="body" color="secondary" align="center">
              {t('forgotPassword.sentMessage', { email: isolateText(sentTo) })}
            </AppText>
            {demo ? (
              <AppText variant="caption" color="muted" align="center" testID="forgot-password-demo-note">
                {t('forgotPassword.demoNote')}
              </AppText>
            ) : null}
          </View>
          <Button label={t('forgotPassword.backToSignIn')} fullWidth onPress={backToSignIn} testID="forgot-password-back" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['left', 'right', 'bottom']} testID="forgot-password-screen">
      <View style={styles.body}>
        <AuthIntro title={t('forgotPassword.title')} subtitle={t('forgotPassword.subtitle')} />
        <FormTextField
          control={form.control}
          name="email"
          label={t('fields.email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
          testID="forgot-password-email"
        />
        <Button
          label={t('forgotPassword.submit')}
          fullWidth
          loading={resetPassword.isPending}
          onPress={() => void submit()}
          testID="forgot-password-submit"
        />
      </View>
    </Screen>
  );
}

function SentIcon() {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.sentIcon, { backgroundColor: theme.colors.primarySoft }]}>
      <Icon name="email-check-outline" size={32} color="primary" />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
    gap: t.spacing.xxl,
    paddingTop: t.spacing.sm,
  },
  sent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xxl,
    paddingBottom: t.spacing.huge,
  },
  sentIcon: {
    width: 72,
    height: 72,
    borderRadius: t.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentTexts: {
    gap: t.spacing.sm,
  },
}));
