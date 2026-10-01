import { useController, useFormState, useWatch } from 'react-hook-form';
import { View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FormTextField, useTranslatedError } from '@/components/forms';
import { Button } from '@/components/ui';
import { vm, type SignUpField } from '@/lib/validation';
import { makeStyles } from '@/theme';

import { GoogleIdentityNote } from '../google-identity-note';
import { GoogleSignInButton } from '../google-sign-in-button';
import { OrDivider } from '../or-divider';
import { PasswordField } from '../password-field';
import { TermsCheckbox } from '../terms-checkbox';
import type { SignUpStepProps } from './step-props';

interface AccountStepProps extends SignUpStepProps {
  /** Signing up with a Google identity: the email is locked and there is no password. */
  withGoogle: boolean;
  /** "Continue with Google" is offered (hidden while signing up with Google). */
  googleAvailable: boolean;
  googleLoading: boolean;
  disabled: boolean;
  onGoogleIdToken: (idToken: string) => void;
  /** Leaves the Google identity and signs up with email and password instead. */
  onUseEmailInstead: () => void;
  /** The email already has an account: leaves the flow for the sign-in screen (email prefilled). */
  onSignInInstead: () => void;
  onFocusField: (field: SignUpField) => void;
  /** The keyboard's "done" on the last field: continue as the primary button does. */
  onSubmit: () => void;
}

/**
 * Step 2 – the account: name, email, phone, password + confirmation (not with Google) and the
 * terms. "Continue with Google" on top fills the name and email and removes the password fields.
 */
export function AccountStep({
  control,
  anchor,
  withGoogle,
  googleAvailable,
  googleLoading,
  disabled,
  onGoogleIdToken,
  onUseEmailInstead,
  onSignInInstead,
  onFocusField,
  onSubmit,
}: AccountStepProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const translateError = useTranslatedError();
  const terms = useController({ control, name: 'acceptedTerms' });
  const { errors } = useFormState({ control, name: 'email' });
  const [email, role] = useWatch({ control, name: ['email', 'role'] });
  // The server answered "already registered": offer to sign in right where the error shows.
  const emailTaken = errors.email?.message === vm('auth.emailTaken');
  const emailHelper = [
    withGoogle ? t('signUp.account.emailFromGoogle') : null,
    role === 'professional' ? t('signUp.account.emailHelperProfessional') : null,
  ]
    .filter(Boolean)
    .join('\n');
  const anchorNames = (event: LayoutChangeEvent) => {
    anchor('firstName')(event);
    anchor('lastName')(event);
  };

  return (
    <>
      {withGoogle ? (
        <GoogleIdentityNote email={email} onUseEmailInstead={onUseEmailInstead} testID="sign-up-google-identity" />
      ) : googleAvailable ? (
        <View style={styles.googleBlock}>
          <GoogleSignInButton onIdToken={onGoogleIdToken} loading={googleLoading} disabled={disabled} testID="sign-up-google" />
          <OrDivider label={t('signUp.account.orEmail')} />
        </View>
      ) : null}

      <View style={styles.nameRow} onLayout={anchorNames}>
        <FormTextField
          control={control}
          name="firstName"
          label={t('fields.firstName')}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => onFocusField('lastName')}
          containerStyle={styles.flex}
          testID="sign-up-first-name"
        />
        <FormTextField
          control={control}
          name="lastName"
          label={t('fields.lastName')}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => onFocusField(withGoogle ? 'phone' : 'email')}
          containerStyle={styles.flex}
          testID="sign-up-last-name"
        />
      </View>

      <View onLayout={anchor('email')}>
        <FormTextField
          control={control}
          name="email"
          label={t('fields.email')}
          disabled={withGoogle}
          helperText={emailHelper || undefined}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          // "username": iOS saves (and suggests) the new password for this account name.
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => onFocusField('phone')}
          testID="sign-up-email"
        />
        {emailTaken ? (
          <Button
            label={t('signUp.account.signInInstead')}
            variant="ghost"
            size="sm"
            onPress={onSignInInstead}
            style={styles.inlineAction}
            testID="sign-up-sign-in-instead"
          />
        ) : null}
      </View>

      <View onLayout={anchor('phone')}>
        <FormTextField
          control={control}
          name="phone"
          label={t('fields.phone')}
          placeholder={t('signUp.account.phonePlaceholder')}
          helperText={role === 'professional' ? t('signUp.account.phoneHelperProfessional') : t('signUp.account.phoneHelperCustomer')}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType={withGoogle ? 'done' : 'next'}
          submitBehavior={withGoogle ? 'blurAndSubmit' : 'submit'}
          onSubmitEditing={withGoogle ? onSubmit : () => onFocusField('password')}
          testID="sign-up-phone"
        />
      </View>

      {withGoogle ? null : (
        <>
          <View onLayout={anchor('password')}>
            <PasswordField
              control={control}
              name="password"
              purpose="new"
              label={t('fields.password')}
              helperText={t('signUp.account.passwordHelper')}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => onFocusField('confirmPassword')}
              testID="sign-up-password"
            />
          </View>
          <View onLayout={anchor('confirmPassword')}>
            <PasswordField
              control={control}
              name="confirmPassword"
              purpose="new"
              label={t('fields.confirmPassword')}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={onSubmit}
              testID="sign-up-confirm-password"
            />
          </View>
        </>
      )}

      <View onLayout={anchor('acceptedTerms')}>
        <TermsCheckbox
          value={terms.field.value}
          onChange={(accepted) => {
            terms.field.onChange(accepted);
            terms.field.onBlur();
          }}
          error={translateError(terms.fieldState.error?.message)}
          testID="sign-up-terms"
        />
      </View>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
  },
  googleBlock: {
    gap: t.spacing.xl,
    marginBottom: t.spacing.xs,
  },
  inlineAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
}));
