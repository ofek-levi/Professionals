import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles } from '@/theme';

import { AppText } from './app-text';
import { Icon } from './icon';

export interface FieldProps {
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
  /** Element rendered at the end of the label row (e.g. a "Clear" link). */
  labelAccessory?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Links the label to the control for web accessibility. */
  nativeID?: string;
}

/**
 * Label + control + helper/error layout shared by every form control (text fields, pickers,
 * chips…), so all fields look and space the same.
 */
export function Field({ label, required, optional, helperText, error, counter, labelAccessory, children, style, nativeID }: FieldProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const hasFooter = Boolean(error || helperText || counter);

  return (
    <View style={[styles.container, style]}>
      {label || labelAccessory ? (
        <View style={styles.labelRow}>
          {label ? (
            <AppText variant="captionStrong" color="secondary" nativeID={nativeID} style={styles.label} numberOfLines={2}>
              {label}
              {required ? <AppText variant="captionStrong" color="danger">{` *`}</AppText> : null}
              {optional && !required ? <AppText variant="caption" color="muted">{` · ${t('optional')}`}</AppText> : null}
            </AppText>
          ) : (
            <View style={styles.label} />
          )}
          {labelAccessory}
        </View>
      ) : null}
      {children}
      {hasFooter ? (
        <View style={styles.footer}>
          {error ? (
            <View style={styles.message} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <Icon name="alert-circle" size={14} color="danger" />
              <AppText variant="caption" color="danger" style={styles.messageText}>
                {error}
              </AppText>
            </View>
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
  messageText: {
    flex: 1,
  },
}));
