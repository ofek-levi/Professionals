import { useId, useState, type ReactNode, type Ref } from 'react';
import { Platform, Pressable, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Field } from './field';
import { Icon, type IconSource } from './icon';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label?: string;
  required?: boolean;
  optional?: boolean;
  /** Already translated error message. */
  error?: string | null;
  helperText?: string;
  /** Shows `length/maxLength` (requires `maxLength` and a controlled `value`). */
  showCounter?: boolean;
  leftIcon?: IconSource;
  /** Static text before the input (currency symbol, country code…). */
  prefix?: string;
  /** Static text or element after the input (units, action). */
  suffix?: ReactNode;
  /** Shows a clear button while the field has text. */
  clearable?: boolean;
  onClear?: () => void;
  /** Minimum visible lines for multiline fields (default 4). */
  minRows?: number;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  ref?: Ref<TextInput>;
}

/**
 * Text input with label, required/optional marker, helper/error text, counter, icons and
 * prefix/suffix. Password fields get a show/hide toggle automatically.
 */
export function TextField({
  label,
  required,
  optional,
  error,
  helperText,
  showCounter = false,
  leftIcon,
  prefix,
  suffix,
  clearable = false,
  onClear,
  minRows = 4,
  disabled = false,
  containerStyle,
  inputStyle,
  multiline,
  secureTextEntry,
  maxLength,
  value,
  onFocus,
  onBlur,
  onChangeText,
  placeholder,
  ref,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const counter = showCounter && maxLength ? `${value?.length ?? 0}/${maxLength}` : undefined;
  const lineHeight = theme.typography.body.lineHeight;
  const showClear = clearable && !disabled && Boolean(value);

  return (
    <Field
      label={label}
      required={required}
      optional={optional}
      helperText={helperText}
      error={error}
      counter={counter}
      style={containerStyle}
      nativeID={labelId}
    >
      <View
        style={[
          styles.box,
          multiline ? styles.multilineBox : null,
          focused ? styles.focused : null,
          error ? styles.error : null,
          disabled ? styles.disabled : null,
        ]}
      >
        {leftIcon ? (
          <Icon name={leftIcon} size={20} color={focused ? 'primary' : 'muted'} style={multiline ? styles.topAligned : null} />
        ) : null}
        {prefix ? (
          <AppText variant="bodyStrong" color="secondary" style={multiline ? styles.topAligned : null}>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={inputProps.accessibilityLabel ?? label ?? placeholder}
          accessibilityLabelledBy={Platform.OS === 'android' && label ? labelId : undefined}
          accessibilityState={{ disabled }}
          aria-invalid={Boolean(error)}
          editable={!disabled}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          multiline={multiline}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry && !revealed}
          textAlignVertical={multiline ? 'top' : 'center'}
          maxFontSizeMultiplier={1.4}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
          style={[
            styles.input,
            multiline ? { minHeight: lineHeight * minRows, paddingTop: theme.spacing.md } : null,
            inputStyle,
          ]}
        />
        {showClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.clearText')}
            hitSlop={10}
            onPress={() => {
              onChangeText?.('');
              onClear?.();
            }}
            style={styles.adornment}
          >
            <Icon name="close-circle" size={18} color="muted" />
          </Pressable>
        ) : null}
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('a11y.hidePassword') : t('a11y.showPassword')}
            hitSlop={10}
            onPress={() => setRevealed((current) => !current)}
            style={styles.adornment}
          >
            <Icon name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color="muted" />
          </Pressable>
        ) : null}
        {typeof suffix === 'string' ? (
          <AppText variant="body" color="muted">
            {suffix}
          </AppText>
        ) : (
          suffix
        )}
      </View>
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 52,
    paddingHorizontal: t.spacing.md + 2,
    borderRadius: t.radii.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  multilineBox: {
    alignItems: 'flex-start',
  },
  focused: {
    borderColor: t.colors.primary,
  },
  error: {
    borderColor: t.colors.danger,
  },
  disabled: {
    backgroundColor: t.colors.surfaceMuted,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    // A web <input> never shrinks below its intrinsic width (~20 characters) unless allowed to:
    // in a narrow field (two per row) it would overflow the box and, in RTL, hide its text.
    minWidth: 0,
    alignSelf: 'stretch',
    ...t.typography.body,
    color: t.colors.text,
    paddingVertical: t.spacing.md,
    paddingHorizontal: 0,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  topAligned: {
    marginTop: t.spacing.md + 1,
  },
  adornment: {
    minHeight: 32,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
