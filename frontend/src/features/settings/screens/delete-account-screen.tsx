/**
 * `/settings/delete-account` – deleting the account: what it cancels right now
 * (`GET /me/deletion-impact`), what stays, the proof that it is the account holder (the password,
 * or a Google sign-in for an account without one) and a last confirmation. On success this device
 * is signed out without a server logout (the deletion ended every session), the entry screen shows
 * and a toast confirms it; a 401 (the account was already deleted) signs out too and says so.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  ErrorState,
  InlineAlert,
  Screen,
  Skeleton,
  SkeletonCard,
  useConfirm,
  useErrorText,
  useErrorToast,
  useToast,
} from '@/components/ui';
import { GoogleSignInButton, useGoogleSignInAvailable } from '@/features/auth/components/google-sign-in-button';
import { PasswordField } from '@/features/auth/components/password-field';
import { useAccountDeletionImpact, useDeleteAccount } from '@/hooks';
import { deleteAccountPasswordSchema, type DeleteAccountPasswordValues } from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import { makeStyles } from '@/theme';
import type { AccountDeletionImpact, DeleteAccountRequest } from '@/types/api';

import { DeletionChanges, DeletionKeeps } from '../components/deletion-impact';

const EDGES = ['left', 'right', 'bottom'] as const;

export default function DeleteAccountScreen() {
  const query = useAccountDeletionImpact();
  if (query.data) return <DeleteAccountView impact={query.data} />;
  return (
    <Screen edges={EDGES} testID="delete-account-screen">
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : (
        <DeleteAccountSkeleton />
      )}
    </Screen>
  );
}

function DeleteAccountView({ impact }: { impact: AccountDeletionImpact }) {
  const styles = useStyles();
  const { t } = useTranslation(['settings', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const errorText = useErrorText();
  const deleteAccount = useDeleteAccount();
  const googleAvailable = useGoogleSignInAvailable();
  const { password: withPassword } = impact.reauthentication;
  const form = useForm<DeleteAccountPasswordValues>({
    resolver: zodResolver(deleteAccountPasswordSchema),
    defaultValues: { password: '' },
    mode: 'onTouched',
  });
  // Too many attempts (429, also the sign-in throttle a wrong password counts towards).
  const [paused, setPaused] = useState<unknown>(null);
  const [googleMismatch, setGoogleMismatch] = useState(false);

  /** On the entry screen, after the sign-out's own effects, which dismiss the account's banners (RealtimeProvider). */
  const toastSignedOut = (title: string) => setTimeout(() => toast.show({ title, tone: 'neutral', icon: 'account-remove-outline' }), 0);

  const showFailure = (error: unknown) => {
    const { status, code, fieldErrors } = toApiError(error);
    const passwordError = fieldErrors?.password?.[0];
    // Already deleted (another device, or a first attempt whose answer was lost): signed out now.
    if (status === 401) toastSignedOut(t('settings:deleteAccount.alreadyGone'));
    else if (code === 'RATE_LIMITED') setPaused(error);
    else if (passwordError) form.setError('password', { type: 'server', message: passwordError }, { shouldFocus: true });
    else if (fieldErrors?.googleIdToken) setGoogleMismatch(true);
    else showError(error);
  };

  /** The last word, then the deletion. The screen is gone once it succeeds (signed out). */
  const deleteWith = async (proof: DeleteAccountRequest) => {
    const confirmed = await confirm({
      title: t('settings:deleteAccount.finalTitle'),
      message: t('settings:deleteAccount.finalMessage'),
      confirmLabel: t('settings:deleteAccount.submit'),
      destructive: true,
    });
    if (!confirmed) return;
    setPaused(null);
    setGoogleMismatch(false);
    try {
      await deleteAccount.mutateAsync(proof);
    } catch (error) {
      showFailure(error);
      return;
    }
    toastSignedOut(t('settings:deleteAccount.deleted'));
  };

  const submitPassword = form.handleSubmit(({ password }) => deleteWith({ password }));
  const busy = deleteAccount.isPending;
  const pausedText = paused ? errorText(paused) : null;

  const footer = withPassword ? (
    <Button
      label={t('settings:deleteAccount.submit')}
      variant="danger"
      fullWidth
      loading={busy}
      onPress={() => void submitPassword()}
      testID="delete-account-submit"
    />
  ) : googleAvailable ? (
    <GoogleSignInButton
      label={t('settings:deleteAccount.googleButton')}
      onIdToken={(googleIdToken) => void deleteWith({ googleIdToken })}
      loading={busy}
      testID="delete-account-google"
    />
  ) : undefined;

  return (
    <Screen edges={EDGES} gap="xxl" keyboardAvoiding footer={footer} testID="delete-account-screen">
      <InlineAlert tone="danger" title={t('settings:deleteAccount.warningTitle')} message={t('settings:deleteAccount.warningMessage')} />
      <DeletionChanges impact={impact} />
      <DeletionKeeps role={impact.role} />

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t('settings:deleteAccount.confirmTitle')}
        </AppText>
        {withPassword ? (
          <PasswordField
            control={form.control}
            name="password"
            purpose="current"
            label={t('settings:deleteAccount.passwordLabel')}
            returnKeyType="go"
            onSubmitEditing={() => void submitPassword()}
            testID="delete-account-password"
          />
        ) : (
          <AppText variant="body" color="secondary">
            {googleAvailable ? t('settings:deleteAccount.googleHint') : t('settings:deleteAccount.googleUnavailable')}
          </AppText>
        )}
        {googleMismatch ? (
          <InlineAlert
            tone="danger"
            title={t('settings:deleteAccount.googleMismatchTitle')}
            message={t('settings:deleteAccount.googleMismatchMessage')}
            testID="delete-account-google-mismatch"
          />
        ) : null}
        {pausedText ? (
          <InlineAlert tone="warning" title={pausedText.title} message={pausedText.description} testID="delete-account-paused" />
        ) : null}
      </View>
    </Screen>
  );
}

function DeleteAccountSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton} testID="delete-account-loading">
      <SkeletonCard lines={2} />
      <Skeleton width="45%" height={18} />
      <SkeletonCard lines={3} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  skeleton: {
    gap: t.spacing.xxl,
  },
}));
