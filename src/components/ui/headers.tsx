import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '@/theme';

import { AppText } from './app-text';

interface ScreenHeaderProps {
  title: string;
  /** Trailing action, typically one `IconButton` or a text button. */
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** In-content header for tab screens: a large title with an optional trailing action. */
export function ScreenHeader({ title, actions, style }: ScreenHeaderProps) {
  const styles = useStyles();
  return (
    <View style={[styles.header, style]}>
      <View style={styles.texts}>
        <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
          {title}
        </AppText>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  /** Trailing text link, e.g. "See all" (only when it does not duplicate a tab). */
  actionLabel?: string;
  onAction?: () => void;
  /** Custom trailing element (overrides the action link). */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Section title (17 semibold) with an optional trailing text action. */
export function SectionHeader({ title, actionLabel, onAction, trailing, style }: SectionHeaderProps) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionTexts}>
        <AppText variant="heading" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
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
          </Pressable>
        ) : null)}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.xl,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
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
  action: {
    minHeight: 32,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
}));
