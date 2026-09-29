import type { FieldPath, FieldValues } from 'react-hook-form';

import { FormTextField, type FormTextFieldProps } from '@/components/forms';

type PasswordFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = Omit<
  FormTextFieldProps<TFieldValues, TName>,
  'secureTextEntry' | 'multiline'
> & {
  /** `current` signs in (password managers fill it); `new` creates one (they may suggest one). */
  purpose: 'current' | 'new';
};

/**
 * Password input bound to react-hook-form: masked with a show/hide toggle (from `TextField`), no
 * auto-capitalization or correction, and the right autofill hints for sign-in or a new password.
 * No `maxLength`: a longer pasted or generated password would be cut silently (and no longer match
 * what the password manager saved); the "too long" validation message explains the limit instead.
 */
export function PasswordField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  purpose,
  ...props
}: PasswordFieldProps<TFieldValues, TName>) {
  const isNew = purpose === 'new';
  return (
    <FormTextField
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      autoComplete={isNew ? 'new-password' : 'current-password'}
      textContentType={isNew ? 'newPassword' : 'password'}
      {...props}
    />
  );
}
