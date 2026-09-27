import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles } from '@/theme';

import { AppText } from '../ui/app-text';
import { Icon, type IconSource } from '../ui/icon';

export interface FormSectionProps {
  title: string;
  description?: string;
  icon?: IconSource;
  /** Shows an "Optional" hint next to the title. */
  optional?: boolean;
  /** Render as a card surface (default) or flat. */
  variant?: 'card' | 'plain';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Titled group of related form fields. */
export function FormSection({ title, description, icon, optional = false, variant = 'card', children, style }: FormSectionProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  return (
    <View style={[styles.section, variant === 'card' ? styles.card : null, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon ? <Icon name={icon} size={20} color="primary" /> : null}
          <AppText variant="heading" accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          {optional ? (
            <AppText variant="caption" color="muted">
              {t('optional')}
            </AppText>
          ) : null}
        </View>
        {description ? (
          <AppText variant="caption" color="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.lg,
  },
  card: {
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  header: {
    gap: t.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  title: {
    flex: 1,
  },
  body: {
    gap: t.spacing.lg,
  },
}));
