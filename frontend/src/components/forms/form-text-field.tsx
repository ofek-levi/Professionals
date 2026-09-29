import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { TextField, type TextFieldProps } from '../ui/text-field';
import { useTranslatedError } from './use-translated-error';

export interface FormTextFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'error' | 'ref'> {
  control: Control<TFieldValues>;
  name: TName;
}

/** The stored value as text (`''` for null/undefined). */
function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

/**
 * `TextField` bound to react-hook-form. Validation messages that are i18n keys
 * (`validation:…`) are translated; other messages are shown as-is.
 */
export function FormTextField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  onBlur,
  ...textFieldProps
}: FormTextFieldProps<TFieldValues, TName>) {
  const translateError = useTranslatedError();
  const {
    field: { ref, value, onChange, onBlur: markTouched },
    fieldState: { error },
  } = useController({ control, name });

  return (
    <TextField
      {...textFieldProps}
      ref={ref}
      value={toText(value)}
      onChangeText={onChange}
      onBlur={(event) => {
        markTouched();
        onBlur?.(event);
      }}
      error={translateError(error?.message)}
    />
  );
}
