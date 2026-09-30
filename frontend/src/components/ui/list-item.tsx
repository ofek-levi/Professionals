import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon } from './icon';

interface ListItemProps {
  title: string;
  /** Trailing value text (e.g. current language) or a custom element (badge, switch…). */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Defaults to `true` when `onPress` is set. */
  showChevron?: boolean;
  /** Red title for destructive actions (sign out, delete). */
  destructive?: boolean;
  disabled?: boolean;
  /**
   * One choice of a single-select list (e.g. the app language): the row is announced as a radio
   * button with this checked state. Wrap the rows in a `View accessibilityRole="radiogroup"`.
   */
  checked?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Menu / settings / list row: a title, an optional trailing value, and a chevron when navigable (mirrors in RTL). */
export function ListItem({
  title,
  trailing,
  onPress,
  showChevron,
  destructive = false,
  disabled = false,
  checked,
  accessibilityHint,
  style,
  testID,
}: ListItemProps) {
  const theme = useTheme();
  const styles = useStyles();
  const chevron = showChevron ?? Boolean(onPress);

  const content = (
    <>
      <View style={styles.texts}>
        <AppText variant="body" color={destructive ? 'danger' : 'default'} numberOfLines={2}>
          {title}
        </AppText>
      </View>
      {typeof trailing === 'string' ? (
        <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.trailingText}>
          {trailing}
        </AppText>
      ) : (
        trailing
      )}
      {chevron ? (
        <Icon name="chevron-right" size={20} color={theme.scheme === 'dark' ? theme.colors.textMuted : theme.colors.borderStrong} flipInRTL />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, style]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole={checked === undefined ? 'button' : 'radio'}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      aria-disabled={disabled}
      // aria-* props (unlike `accessibilityState`) also reach the DOM on web (react-native-web).
      aria-checked={checked}
      disabled={disabled}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
    >
      {content}
    </Pressable>
  );
}

interface StatTileProps {
  label: string;
  value: string | number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Minimal metric tile: the label and a large value on a soft surface. Takes an equal share of its
 * row (`flex: 1`, no minimum width); tappable tiles dim when pressed.
 */
export function StatTile({ label, value, onPress, style, testID }: StatTileProps) {
  const styles = useStyles();
  const body = (
    <>
      <View style={styles.statTop}>
        <AppText variant="caption" color="secondary" numberOfLines={2} style={styles.flexShrink}>
          {label}
        </AppText>
        {/* Tappable tiles get the same chevron as every other navigable row. */}
        {onPress ? <Icon name="chevron-right" size={18} color="muted" flipInRTL style={styles.statChevron} /> : null}
      </View>
      <AppText variant="title" tabular numberOfLines={1}>
        {value}
      </AppText>
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.stat, style]} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      testID={testID}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={({ pressed }) => [styles.stat, pressed ? styles.statPressed : null, style]}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 52,
    paddingVertical: t.spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.45,
  },
  texts: {
    flex: 1,
  },
  trailingText: {
    maxWidth: '45%',
  },
  flexShrink: {
    flexShrink: 1,
  },
  // Tiles share a row equally and may shrink below their content width (three fit a phone row).
  // Inside wrapping grids pass a `minWidth` through `style`.
  stat: {
    flex: 1,
    minWidth: 0,
    gap: t.spacing.xs,
    paddingVertical: t.spacing.md + 2,
    paddingHorizontal: t.spacing.lg,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
  },
  statPressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  statChevron: {
    marginStart: 'auto',
  },
}));
