import type { ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon } from '@/components/ui';
import { makeStyles } from '@/theme';

interface FormBlockProps {
  title: string;
  optional?: boolean;
  /** Translated error shown under the content. */
  error?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
  testID?: string;
}

/** One part of the request form: a short title, the control and an inline error. */
export function FormBlock({ title, optional = false, error, onLayout, children, testID }: FormBlockProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  return (
    <View style={styles.block} onLayout={onLayout} testID={testID}>
      <AppText variant="subheading" accessibilityRole="header">
        {title}
        {optional ? (
          <AppText variant="body" color="muted">
            {` · ${t('optional')}`}
          </AppText>
        ) : null}
      </AppText>
      {children}
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icon name="alert-circle" size={14} color="danger" />
          <AppText variant="caption" color="danger" style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  block: {
    gap: t.spacing.md,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.xs,
    marginTop: -t.spacing.xs,
  },
  flex: {
    flex: 1,
  },
}));
