/**
 * `/auth/sign-up?role=customer|professional` – create an account, one step per screen with a slim
 * progress bar and a sticky primary button:
 * 1. role ("I need a service" / "I offer services"),
 * 2. account (name, email, phone, password + confirmation, terms; or "Continue with Google"),
 * 3. services (professionals: optional business name + 1–10 catalog services),
 * 4. service area (professionals: base address + radius).
 * Customers finish after step 2. A role in the link skips step 1 (the flow starts on the account
 * step and the progress counts from there). Each step is validated before moving on (one
 * react-hook-form instance with the shared zod schemas); server field errors return to the step
 * that shows them. The header back arrow, gestures, Android back and – on web – the browser's back
 * button go to the previous step (and leave from the first one).
 *
 * A new Google identity (from here or from the sign-in screen) prefills the names, locks the email
 * and drops the password fields; it is kept in memory only (`usePendingGoogleSignUp`).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { View, type LayoutChangeEvent, type ScrollView } from 'react-native';
import Animated, { Easing, FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { Button, Screen, useErrorToast, useToast } from '@/components/ui';
import { useGoogleAuth, useRegister, useRouteParam } from '@/hooks';
import { useAppLanguage } from '@/i18n/hooks';
import { parseSignUpRole, ROLE_PARAM, routes } from '@/lib/routes';
import {
  applyGoogleProfile,
  createEmptySignUpFormValues,
  PROFILE_LIMITS,
  registerFieldErrorsToForm,
  SIGN_UP_STEP_FIELDS,
  signUpFormSchema,
  signUpStepsFor,
  toRegisterRequest,
  type SignUpField,
  type SignUpFormValues,
  type SignUpStep,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import { makeStyles, useTheme } from '@/theme';

import { authEmailHint } from '../auth-email-hint';
import { AuthIntro } from '../components/auth-intro';
import { AuthLinkRow } from '../components/auth-link-row';
import { GoogleIdentityNote } from '../components/google-identity-note';
import { useGoogleSignInAvailable } from '../components/google-sign-in-button';
import { AccountStep } from '../components/sign-up/account-step';
import { AreaStep } from '../components/sign-up/area-step';
import { RoleStep } from '../components/sign-up/role-step';
import { ServicesStep } from '../components/sign-up/services-step';
import { firstInvalidFieldOfStep, firstInvalidStep, initialSignUpStepIndex, signUpProgress } from '../components/sign-up/sign-up-model';
import { StepProgress } from '../components/step-progress';
import { pendingGoogleSignUpStore, usePendingGoogleSignUp } from '../pending-google-sign-up';
import { useBrowserBack } from '../use-browser-back';
import { useSingleFlight } from '../use-single-flight';
import { useWelcomeToast } from '../use-welcome-toast';

type SignUpFormOutput = z.output<typeof signUpFormSchema>;


/** The progress bar's entrance once the role is chosen. */
const PROGRESS_ENTERING = FadeInDown.duration(320).easing(Easing.out(Easing.cubic));
/** Keeps the content under the progress bar moving smoothly when the bar appears. */
const CONTENT_LAYOUT = LinearTransition.duration(320).easing(Easing.out(Easing.cubic));

export default function SignUpScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['auth', 'validation']);
  const toast = useToast();
  const showError = useErrorToast();
  const welcome = useWelcomeToast();
  const language = useAppLanguage();
  const register = useRegister();
  const googleAuth = useGoogleAuth();
  const googleAvailable = useGoogleSignInAvailable();
  const roleParam = parseSignUpRole(useRouteParam(ROLE_PARAM));
  const pendingGoogle = usePendingGoogleSignUp();
  const flight = useSingleFlight();

  const [defaultValues] = useState(() =>
    createEmptySignUpFormValues({ role: roleParam, googleProfile: pendingGoogle?.profile ?? null }),
  );
  const form = useForm<SignUpFormValues, unknown, SignUpFormOutput>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues,
    mode: 'onTouched',
  });
  const { control, getValues, setValue, trigger, setError, reset, setFocus, getFieldState } = form;
  const [role, authMethod] = useWatch({ control, name: ['role', 'authMethod'] });
  const withGoogle = authMethod === 'google';

  const steps = signUpStepsFor(role);
  // A role from the link skips the role step: the flow starts (and going back leaves) there.
  const [firstIndex] = useState(() => initialSignUpStepIndex(roleParam));
  const [stepIndex, setStepIndex] = useState(firstIndex);
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index];
  const isLastStep = index === steps.length - 1;
  const progress = signUpProgress(steps, index, firstIndex, role);
  const reduceMotion = useReducedMotion();
  // Content below the progress bar glides down when the bar appears (no jump).
  const contentLayout = reduceMotion ? undefined : CONTENT_LAYOUT;
  const mutating = register.isPending || googleAuth.isPending;
  // Validating a step, creating the account or exchanging a Google token.
  const busy = flight.running || mutating;
  // "Continue" / "Create account" is being handled (validation, then the request).
  const [advancing, setAdvancing] = useState(false);
  const [exitTo, setExitTo] = useState<Href | null>(null);

  // Where fields sit in the scroll content, to bring the first invalid one into view.
  const scrollRef = useRef<ScrollView>(null);
  const bodyY = useRef(0);
  const stepY = useRef(0);
  const positions = useRef<Partial<Record<SignUpField, number>>>({});
  const anchor = (field: SignUpField) => (event: LayoutChangeEvent) => {
    positions.current[field] = event.nativeEvent.layout.y;
  };
  const scrollToField = (field: SignUpField | null) => {
    const y = field ? (positions.current[field] ?? 0) : 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + stepY.current + y - theme.spacing.lg), animated: true });
  };

  // The pending Google identity belongs to this sign-up: leaving the flow forgets it.
  useEffect(() => () => pendingGoogleSignUpStore.clear(), []);

  // The confirmation is compared with the password: check it again when the password changes.
  const password = useWatch({ control, name: 'password' });
  useEffect(() => {
    if (getFieldState('confirmPassword').isTouched) void trigger('confirmPassword');
  }, [password, getFieldState, trigger]);

  // Header back, gestures and hardware back return to the previous step; the first step leaves.
  // On web the browser's back button does the same. Never while submitting or leaving: then the
  // navigation is the screen's own.
  const canStepBack = index > firstIndex && !busy && exitTo === null;
  const stepBack = () => {
    setStepIndex(Math.max(firstIndex, index - 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  usePreventRemove(canStepBack, stepBack);
  useBrowserBack(canStepBack, stepBack);

  // Leave only once the step guard above was lifted.
  useEffect(() => {
    if (exitTo) router.dismissTo(exitTo);
  }, [exitTo, router]);

  const goToStep = (target: SignUpStep) => {
    const targetIndex = steps.indexOf(target);
    if (targetIndex >= 0) setStepIndex(targetIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  /** Leaves for the sign-in screen with the email prefilled (it already has an account). */
  const signInInstead = () => {
    authEmailHint.set(getValues('email'));
    setExitTo(routes.auth.login);
  };

  /** Marks a field as touched, so its error updates while it is being fixed. */
  const touch = <TName extends SignUpField>(name: TName) => setValue(name, getValues(name), { shouldTouch: true });

  const switchToEmail = () => {
    pendingGoogleSignUpStore.clear();
    reset({ ...getValues(), authMethod: 'password', email: '', password: '', confirmPassword: '' }, { keepDefaultValues: true });
  };

  const applyServerErrors = (error: unknown) => {
    const apiError = toApiError(error);
    if (apiError.code === 'INVALID_GOOGLE_TOKEN') {
      // The Google identity can't be used (e.g. expired): offer "Continue with Google" again.
      switchToEmail();
      goToStep('account');
      showError(error);
      return;
    }
    const fieldErrors = registerFieldErrorsToForm(apiError.fieldErrors);
    const fields = steps.flatMap((candidate) => SIGN_UP_STEP_FIELDS[candidate].filter((field) => fieldErrors[field]));
    fields.forEach((field) => setError(field, { type: 'server', message: fieldErrors[field] }));
    const target = firstInvalidStep(steps, fields);
    if (!target) {
      showError(error);
    } else if (target === step) {
      // Shown right on this step (e.g. "already registered" + "Sign in with this email"): no toast
      // repeating it, just bring it into view.
      scrollToField(firstInvalidFieldOfStep(step, fields));
    } else {
      // Back to an earlier step: say why the flow moved.
      goToStep(target);
      showError(error, { title: t('auth:signUp.fixFields') });
    }
  };

  const createAccount = async (values: SignUpFormOutput) => {
    const googleIdToken = values.authMethod === 'google' ? (pendingGoogle?.idToken ?? null) : null;
    if (values.authMethod === 'google' && !googleIdToken) {
      // The Google identity is gone (should not happen): sign up with email instead.
      switchToEmail();
      goToStep('account');
      toast.show({ title: t('validation:auth.googleSignInRequired'), tone: 'warning' });
      return;
    }
    try {
      const session = await register.mutateAsync(toRegisterRequest(values, { preferredLanguage: language, googleIdToken }));
      welcome(session.user, 'signUp');
    } catch (error) {
      // Gone already (e.g. signed in meanwhile): nobody to show the errors to.
      if (flight.isMounted()) applyServerErrors(error);
    }
  };

  const showInvalidForm = (errors: FieldErrors<SignUpFormValues>) => {
    // Every step was checked on the way; this catches what changed since.
    const target = firstInvalidStep(steps, Object.keys(errors));
    if (target) goToStep(target);
    toast.show({ title: t('auth:signUp.fixFields'), tone: 'warning' });
  };

  // One at a time: a double tap on "Create account" must not register twice (the button only shows
  // its loading state after validation, a few awaits after the first tap).
  const next = () =>
    flight.run(async () => {
      setAdvancing(true);
      try {
        const fields = SIGN_UP_STEP_FIELDS[step];
        fields.forEach((field) => touch(field));
        const valid = await trigger(fields);
        if (!valid) {
          scrollToField(firstInvalidFieldOfStep(step, fields.filter((field) => getFieldState(field).invalid)));
          return;
        }
        if (isLastStep) await form.handleSubmit(createAccount, showInvalidForm)();
        else goToStep(steps[index + 1]);
      } finally {
        if (flight.isMounted()) setAdvancing(false);
      }
    });

  const continueWithGoogle = (idToken: string) =>
    flight.run(async () => {
      try {
        const result = await googleAuth.mutateAsync(idToken);
        if (result.status === 'signed_in') {
          // This Google account already has an account: it is signed in instead.
          welcome(result.session.user, 'signIn');
          return;
        }
        if (flight.isMounted()) reset(applyGoogleProfile(getValues(), result.profile), { keepDefaultValues: true });
      } catch (error) {
        if (flight.isMounted()) showError(error);
      }
    });

  const intro = (() => {
    switch (step) {
      case 'role':
        return { title: t('auth:signUp.role.title'), subtitle: t('auth:signUp.role.subtitle') };
      case 'account':
        return withGoogle
          ? { title: t('auth:signUp.account.googleTitle'), subtitle: t('auth:signUp.account.googleSubtitle') }
          : { title: t('auth:signUp.account.title'), subtitle: t('auth:signUp.account.subtitle') };
      case 'services':
        return { title: t('auth:signUp.services.title'), subtitle: t('auth:signUp.services.subtitle', { max: PROFILE_LIMITS.maxCategories }) };
      case 'area':
        return { title: t('auth:signUp.area.title'), subtitle: t('auth:signUp.area.subtitle') };
    }
  })();

  const footer = (
    <Button
      label={isLastStep ? t('auth:signUp.submit') : t('auth:signUp.continue')}
      fullWidth
      // The last step shows its loading state from the first tap on (validation included).
      loading={(isLastStep && advancing) || register.isPending}
      disabled={googleAuth.isPending}
      onPress={() => void next()}
      testID="sign-up-continue"
    />
  );

  return (
    <Screen edges={['left', 'right', 'bottom']} scrollRef={scrollRef} footer={footer} testID="sign-up-screen">
      <View
        style={styles.body}
        onLayout={(event) => {
          bodyY.current = event.nativeEvent.layout.y;
        }}
      >
        {/* Hidden until the role (and so the flow's length) is known; then it slides in and fills. */}
        {progress.total !== null && progress.total > 1 ? (
          <Animated.View entering={reduceMotion ? undefined : PROGRESS_ENTERING}>
            <StepProgress step={progress.step} total={progress.total} testID="sign-up-progress" />
          </Animated.View>
        ) : null}
        <Animated.View layout={contentLayout}>
          <AuthIntro title={intro.title} subtitle={intro.subtitle} />
        </Animated.View>
        {/* The Google tap took effect: say so from the first step on (the account step has its own). */}
        {withGoogle && step === 'role' ? <GoogleIdentityNote email={getValues('email')} testID="sign-up-google-identity" /> : null}

        <Animated.View
          key={step}
          layout={contentLayout}
          style={styles.step}
          onLayout={(event) => {
            stepY.current = event.nativeEvent.layout.y;
          }}
          testID={`sign-up-step-${step}`}
        >
          {step === 'role' ? <RoleStep control={control} anchor={anchor} /> : null}
          {step === 'account' ? (
            <AccountStep
              control={control}
              anchor={anchor}
              withGoogle={withGoogle}
              googleAvailable={googleAvailable}
              googleLoading={googleAuth.isPending}
              disabled={mutating}
              onGoogleIdToken={(idToken) => void continueWithGoogle(idToken)}
              onUseEmailInstead={switchToEmail}
              onSignInInstead={signInInstead}
              onFocusField={(field) => setFocus(field)}
              onSubmit={() => void next()}
            />
          ) : null}
          {step === 'services' ? <ServicesStep control={control} anchor={anchor} /> : null}
          {step === 'area' ? <AreaStep control={control} anchor={anchor} /> : null}
        </Animated.View>

        {step === 'role' || step === 'account' ? (
          <Animated.View layout={contentLayout} style={styles.bottom}>
            <AuthLinkRow
              prompt={t('auth:signUp.haveAccount')}
              actionLabel={t('auth:signUp.signIn')}
              onPress={() => setExitTo(routes.auth.login)}
              testID="sign-up-sign-in"
            />
          </Animated.View>
        ) : null}
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
  step: {
    gap: t.spacing.lg,
  },
  // Sits at the bottom of the screen when the step is short.
  bottom: {
    marginTop: 'auto',
  },
}));
