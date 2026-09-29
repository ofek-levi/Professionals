/**
 * `/auth/login` – sign in with email and password, or "Continue with Google". Wrong credentials
 * show one inline alert above the button (the same for an unknown email and a wrong password). A
 * Google identity without an account continues in the sign-up flow (prefilled, in memory only).
 * On success the protected routes replace the auth screens with the role's home. With the mock
 * backend a demo account (email + password) is suggested and can be filled in with one tap.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormTextField } from '@/components/forms';
import { AppText, Button, InlineAlert, Screen, useErrorToast } from '@/components/ui';
import { useDemoTools } from '@/features/settings/use-demo-tools';
import { useGoogleAuth, useLogin } from '@/hooks';
import { routes } from '@/lib/routes';
import { createEmptyLoginFormValues, loginSchema, toLoginRequest, type LoginFormValues } from '@/lib/validation/auth';
import { toApiError } from '@/services/api/errors';
import { makeStyles } from '@/theme';
import { isolateLtr } from '@/utils/bidi';

import { authEmailHint, useAuthEmailHint } from '../auth-email-hint';
import { AuthIntro } from '../components/auth-intro';
import { AuthLinkRow } from '../components/auth-link-row';
import { GoogleSignInButton, useGoogleSignInAvailable } from '../components/google-sign-in-button';
import { PasswordField } from '../components/password-field';
import { useSingleFlight } from '../use-single-flight';
import { useWelcomeToast } from '../use-welcome-toast';

type LoginFormOutput = z.output<typeof loginSchema>;

const LOGIN_FIELDS = ['email', 'password'] as const satisfies readonly (keyof LoginFormValues)[];

function isLoginField(value: string): value is keyof LoginFormValues {
  return (LOGIN_FIELDS as readonly string[]).includes(value);
}

export default function LoginScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['auth', 'errors']);
  const showError = useErrorToast();
  const welcome = useWelcomeToast();
  const login = useLogin();
  const googleAuth = useGoogleAuth();
  const googleAvailable = useGoogleSignInAvailable();
  const { demoSignIn } = useDemoTools();
  const flight = useSingleFlight();

  const form = useForm<LoginFormValues, unknown, LoginFormOutput>({
    resolver: zodResolver(loginSchema),
    defaultValues: createEmptyLoginFormValues(),
    mode: 'onTouched',
  });
  const { control, setError, setFocus, reset, setValue } = form;
  // The credentials the server rejected: the alert shows until either field changes.
  const [rejected, setRejected] = useState<LoginFormValues | null>(null);
  // An email typed elsewhere (e.g. the sign-up found an existing account) starts a fresh form.
  useAuthEmailHint((hintedEmail) => {
    reset(createEmptyLoginFormValues(hintedEmail));
    setRejected(null);
  });
  // Back from "Forgot password?": the rejected password and its alert are stale by now.
  const resettingPassword = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!resettingPassword.current) return;
      resettingPassword.current = false;
      setValue('password', '');
      setRejected(null);
    }, [setValue]),
  );
  const [email, password] = useWatch({ control, name: ['email', 'password'] });
  const showRejected = rejected !== null && rejected.email === email && rejected.password === password;
  const busy = login.isPending || googleAuth.isPending;

  // One sign-in at a time: a double tap (or Enter + tap) must not send the request twice.
  const submit = () =>
    flight.run(
      form.handleSubmit(async (values) => {
        setRejected(null);
        try {
          const session = await login.mutateAsync(toLoginRequest(values));
          welcome(session.user, 'signIn');
        } catch (error) {
          if (flight.isMounted()) showSignInError(error);
        }
      }),
    );

  const showSignInError = (error: unknown) => {
    const apiError = toApiError(error);
    if (apiError.code === 'INVALID_CREDENTIALS') {
      // As typed (the submitted values are normalized), to compare with the fields.
      setRejected(form.getValues());
      return;
    }
    let mapped = 0;
    for (const [field, messages] of Object.entries(apiError.fieldErrors ?? {})) {
      if (!isLoginField(field) || !messages[0]) continue;
      setError(field, { type: 'server', message: messages[0] });
      mapped += 1;
    }
    if (mapped === 0) showError(error);
  };

  const continueWithGoogle = (idToken: string) =>
    flight.run(async () => {
      try {
        const result = await googleAuth.mutateAsync(idToken);
        if (result.status === 'signed_in') welcome(result.session.user, 'signIn');
        // A new Google identity: the sign-up flow picks it up (name and email prefilled).
        else if (flight.isMounted()) router.push(routes.auth.signUp());
      } catch (error) {
        if (flight.isMounted()) showError(error);
      }
    });

  const fillDemoAccount = () => {
    if (!demoSignIn) return;
    reset({ email: demoSignIn.email, password: demoSignIn.password });
    setRejected(null);
  };

  return (
    <Screen edges={['left', 'right', 'bottom']} testID="login-screen">
      <View style={styles.body}>
        <AuthIntro title={t('auth:login.title')} subtitle={t('auth:login.subtitle')} withBrandMark />

        <View style={styles.fields}>
          <FormTextField
            control={control}
            name="email"
            label={t('auth:fields.email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => setFocus('password')}
            testID="login-email"
          />
          <PasswordField
            control={control}
            name="password"
            purpose="current"
            label={t('auth:fields.password')}
            // On the label row: an error appearing under the field on blur doesn't move it.
            labelAccessory={
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  authEmailHint.set(email);
                  resettingPassword.current = true;
                  router.push(routes.auth.forgotPassword);
                }}
                hitSlop={12}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
                testID="login-forgot-password"
              >
                <AppText variant="captionStrong" color="primary">
                  {t('auth:login.forgotPassword')}
                </AppText>
              </Pressable>
            }
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            testID="login-password"
          />
        </View>

        <View style={styles.actions}>
          {showRejected ? (
            <InlineAlert
              tone="danger"
              title={t('errors:codes.INVALID_CREDENTIALS.title')}
              message={t('errors:codes.INVALID_CREDENTIALS.description')}
              testID="login-invalid-credentials"
            />
          ) : null}
          <Button
            label={t('auth:login.submit')}
            fullWidth
            loading={login.isPending}
            disabled={busy && !login.isPending}
            onPress={() => void submit()}
            testID="login-submit"
          />
          {googleAvailable ? (
            <GoogleSignInButton
              onIdToken={(idToken) => void continueWithGoogle(idToken)}
              loading={googleAuth.isPending}
              disabled={busy && !googleAuth.isPending}
              testID="login-google"
            />
          ) : null}
        </View>

        <View style={styles.footer}>
          <AuthLinkRow
            prompt={t('auth:login.noAccount')}
            actionLabel={t('auth:login.createAccount')}
            onPress={() => router.push(routes.auth.signUp())}
            testID="login-create-account"
          />
          {demoSignIn ? (
            <View style={styles.demoHint}>
              <AppText variant="caption" color="muted" align="center" testID="login-demo-hint">
                {t('auth:login.demoHint', { email: isolateLtr(demoSignIn.email), password: isolateLtr(demoSignIn.password) })}
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={fillDemoAccount}
                hitSlop={12}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
                testID="login-fill-demo"
              >
                <AppText variant="captionStrong" color="primary">
                  {t('auth:login.fillDemo')}
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
    flexGrow: 1,
    gap: t.spacing.xxl,
    paddingTop: t.spacing.sm,
  },
  fields: {
    gap: t.spacing.lg,
  },
  pressed: {
    opacity: 0.6,
  },
  actions: {
    gap: t.spacing.lg,
  },
  // Sits at the bottom of the screen when the form is short.
  footer: {
    marginTop: 'auto',
    gap: t.spacing.xs,
  },
  demoHint: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: t.spacing.sm,
    rowGap: t.spacing.xxs,
  },
}));
