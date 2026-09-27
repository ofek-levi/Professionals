import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  /** Leading icon inside a soft rounded square. */
  icon?: IconSource;
  iconTone?: StatusTone;
  /** Mirrors a directional leading icon (e.g. `logout`) in RTL. */
  iconFlipInRTL?: boolean;
  /** Custom leading element (avatar, category icon…); overrides `icon`. */
  leading?: ReactNode;
  /** Trailing value text (e.g. current language) or a custom element (badge, switch…). */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Defaults to `true` when `onPress` is set. */
  showChevron?: boolean;
  /** Red title/icon for destructive actions (sign out, delete). */
  destructive?: boolean;
  disabled?: boolean;
  /** Lines of subtitle before truncation (default 2). */
  subtitleLines?: number;
  /**
   * One choice of a single-select list (e.g. the app language): the row is announced as a radio
   * button with this checked state. Wrap the rows in a `View accessibilityRole="radiogroup"`.
   */
  checked?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Menu / settings / list row. Chevron mirrors in RTL. */
export function ListItem({
  title,
  subtitle,
  icon,
  iconTone = 'neutral',
  iconFlipInRTL = false,
  leading,
  trailing,
  onPress,
  showChevron,
  destructive = false,
  disabled = false,
  subtitleLines = 2,
  checked,
  accessibilityHint,
  style,
  testID,
}: ListItemProps) {
  const theme = useTheme();
  const styles = useStyles();
  const tone = theme.colors.tones[destructive ? 'danger' : iconTone];
  const chevron = showChevron ?? Boolean(onPress);

  const content = (
    <>
      {leading ??
        (icon ? (
          <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
            <Icon name={icon} size={20} color={tone.fg} flipInRTL={iconFlipInRTL} />
          </View>
        ) : null)}
      <View style={styles.texts}>
        <AppText variant="bodyStrong" color={destructive ? 'danger' : 'default'} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="muted" numberOfLines={subtitleLines}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {typeof trailing === 'string' ? (
        <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.trailingText}>
          {trailing}
        </AppText>
      ) : (
        trailing
      )}
      {chevron ? <Icon name="chevron-right" size={20} color="muted" flipInRTL /> : null}
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
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      // `aria-checked` (unlike `accessibilityState.checked`) also reaches the DOM on web.
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

/** Alias used for settings/profile menus. */
export const MenuRow = ListItem;
export type MenuRowProps = ListItemProps;

export interface KeyValueRowProps {
  label: string;
  value: ReactNode;
  icon?: IconSource;
  /** Stack label above value for long values. */
  stacked?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Label/value pair for detail screens ("Budget  ₪450"). */
export function KeyValueRow({ label, value, icon, stacked = false, style }: KeyValueRowProps) {
  const styles = useStyles();
  return (
    <View style={[stacked ? styles.kvStacked : styles.kvRow, style]}>
      <View style={styles.kvLabel}>
        {icon ? <Icon name={icon} size={18} color="muted" /> : null}
        <AppText variant="caption" color="muted" numberOfLines={2} style={styles.flexShrink}>
          {label}
        </AppText>
      </View>
      {typeof value === 'string' || typeof value === 'number' ? (
        <AppText variant="bodyStrong" align={stacked ? 'start' : 'end'} style={stacked ? null : styles.kvValue}>
          {value}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

export interface StatTileProps {
  label: string;
  value: string | number;
  icon?: IconSource;
  tone?: StatusTone;
  hint?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Dashboard metric tile. Takes an equal share of its row (`flex: 1`, no minimum width). */
export function StatTile({ label, value, icon, tone = 'brand', hint, onPress, style }: StatTileProps) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = theme.colors.tones[tone];
  const body = (
    <>
      <View style={styles.statTop}>
        {icon ? (
          <View style={[styles.statIcon, { backgroundColor: colors.bg }]}>
            <Icon name={icon} size={18} color={colors.fg} />
          </View>
        ) : null}
        {onPress ? <Icon name="chevron-right" size={18} color="muted" flipInRTL /> : null}
      </View>
      <AppText variant="title" tabular numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="secondary" numberOfLines={2}>
        {label}
      </AppText>
      {hint ? (
        <AppText variant="tiny" color={tone} numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </>
  );
  if (!onPress) return <View style={[styles.stat, style]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
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
    minHeight: 56,
    paddingVertical: t.spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: t.radii.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  trailingText: {
    maxWidth: '40%',
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.lg,
    paddingVertical: t.spacing.sm,
  },
  kvStacked: {
    gap: t.spacing.xs,
    paddingVertical: t.spacing.sm,
  },
  kvLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    flexShrink: 1,
  },
  kvValue: {
    flexShrink: 1,
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
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statPressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: t.spacing.xs,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: t.radii.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
