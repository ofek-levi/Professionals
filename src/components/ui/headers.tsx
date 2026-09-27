import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconSource } from './icon';
import { IconButton } from './icon-button';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Small line above the title (e.g. a greeting or context). */
  eyebrow?: string;
  /** Trailing actions, typically `IconButton`s. */
  actions?: ReactNode;
  /** Shows a back button on the start edge. */
  onBack?: () => void;
  /** Large (display) title for tab roots; compact title otherwise. Defaults to `true`. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** In-content header for tab screens (large title, subtitle and trailing actions). */
export function ScreenHeader({ title, subtitle, eyebrow, actions, onBack, large = true, style }: ScreenHeaderProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <IconButton
          icon="arrow-left"
          flipInRTL
          variant="surface"
          accessibilityLabel={t('a11y.back')}
          onPress={onBack}
          style={styles.back}
        />
      ) : null}
      <View style={styles.texts}>
        {eyebrow ? (
          <AppText variant="captionStrong" color="muted" numberOfLines={1}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant={large ? 'display' : 'title'} accessibilityRole="header" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: IconSource;
  /** Trailing link, e.g. "See all". */
  actionLabel?: string;
  onAction?: () => void;
  /** Custom trailing element (overrides the action link). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, subtitle, icon, actionLabel, onAction, trailing, style }: SectionHeaderProps) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionTexts}>
        <View style={styles.sectionTitleRow}>
          {icon ? <Icon name={icon} size={18} color="secondary" /> : null}
          <AppText variant="heading" accessibilityRole="header" numberOfLines={1} style={styles.flexShrink}>
            {title}
          </AppText>
        </View>
        {subtitle ? (
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ??
        (actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}, ${title}`}
            onPress={onAction}
            hitSlop={12}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          >
            <AppText variant="captionStrong" color="primary">
              {actionLabel}
            </AppText>
            <Icon name="chevron-right" size={16} color="primary" flipInRTL />
          </Pressable>
        ) : null)}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.lg,
  },
  back: {
    marginTop: t.spacing.xxs,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.xxs,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
    marginBottom: t.spacing.md,
  },
  sectionTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  flexShrink: {
    flexShrink: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xxs,
    minHeight: 32,
  },
  pressed: {
    opacity: 0.6,
  },
}));
