import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles } from '@/theme';

import { AppText } from './app-text';
import { Icon } from './icon';

interface FieldProps {
  label?: string;
  /** Adds a required marker next to the label. */
  required?: boolean;
  /** Adds an "Optional" hint next to the label. */
  optional?: boolean;
  helperText?: string;
  /** Already translated error message; replaces the helper text. */
  error?: string | null;
  /** Trailing text under the control (e.g. `120/500`). */
  counter?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Links the label to the control for web accessibility. */
  nativeID?: string;
  /**
   * Trailing element on the label row, e.g. a "Forgot password?" link. Unlike content under the
   * control, it doesn't move when an error appears (so a tap on it isn't lost to the shift).
   */
  labelAccessory?: ReactNode;
  /**
   * Where the error shows: under the control (default) or right under the label – for tall
   * controls (a long list, a map) whose bottom edge is far from where the problem is fixed.
   * The helper text and counter always stay under the control.
   */
  errorPosition?: 'bottom' | 'top';
}

/**
 * Label + control + helper/error layout shared by every form control (text fields, pickers,
 * chips…), so all fields look and space the same.
 */
export function Field({
  label,
  required,
  optional,
  helperText,
  error,
  counter,
  children,
  style,
  nativeID,
  labelAccessory,
  errorPosition = 'bottom',
}: FieldProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const errorOnTop = errorPosition === 'top' && Boolean(error);
  const footerError = errorOnTop ? null : error;
  const hasFooter = Boolean(footerError || helperText || counter);

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="captionStrong" color="secondary" nativeID={nativeID} style={styles.label} numberOfLines={2}>
            {label}
            {required ? <AppText variant="captionStrong" color="danger">{` *`}</AppText> : null}
            {optional && !required ? <AppText variant="caption" color="muted">{` · ${t('optional')}`}</AppText> : null}
          </AppText>
          {labelAccessory}
        </View>
      ) : null}
      {errorOnTop ? <FieldError message={error ?? ''} standalone /> : null}
      {children}
      {hasFooter ? (
        <View style={styles.footer}>
          {footerError ? (
            <FieldError message={footerError} />
          ) : helperText ? (
            <AppText variant="caption" color="muted" style={styles.messageText}>
              {helperText}
            </AppText>
          ) : (
            <View style={styles.messageText} />
          )}
          {counter ? (
            <AppText variant="caption" color={error ? 'danger' : 'muted'} tabular>
              {counter}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The error line; `standalone` when it is not in the footer row (next to a counter). */
function FieldError({ message, standalone = false }: { message: string; standalone?: boolean }) {
  const styles = useStyles();
  return (
    <View style={standalone ? styles.messageStandalone : styles.message} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name="alert-circle" size={14} color="danger" />
      <AppText variant="caption" color="danger" style={styles.messageText}>
        {message}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xs + 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  label: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
  },
  message: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.xs,
  },
  // Not in the footer row: sized by its content (no `flex`, which would zero its height in a column).
  messageStandalone: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.xs,
  },
  messageText: {
    flex: 1,
  },
}));
