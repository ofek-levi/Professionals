import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconSource;
  /** Small counter shown after the label. */
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Visual segment heights; the touch area is extended vertically to `theme.layout.minTouchSize`. */
const SEGMENT_HEIGHT = { md: 34, sm: 28 } as const;

/** Compact iOS-style segmented switch for 2–4 mutually exclusive views (e.g. Active | Past). */
export function SegmentedControl<T extends string>({ options, value, onChange, size = 'md', style, testID }: SegmentedControlProps<T>) {
  const theme = useTheme();
  const styles = useStyles();
  const small = size === 'sm';
  // Vertical only: horizontally the segments sit next to each other.
  const slop = Math.max(0, Math.ceil((theme.layout.minTouchSize - SEGMENT_HEIGHT[size]) / 2));
  const hitSlop = slop > 0 ? { top: slop, bottom: slop } : undefined;

  return (
    <View style={[styles.track, small ? styles.trackSmall : null, style]} accessibilityRole="tablist" testID={testID}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={typeof option.count === 'number' ? `${option.label}, ${option.count}` : option.label}
            accessibilityState={{ selected }}
            hitSlop={hitSlop}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.segment,
              small ? styles.segmentSmall : null,
              selected ? styles.selected : null,
              pressed && !selected ? styles.pressed : null,
            ]}
          >
            {option.icon ? <Icon name={option.icon} size={small ? 14 : 16} color={selected ? 'default' : 'muted'} /> : null}
            <AppText
              variant={small ? 'label' : 'captionStrong'}
              color={selected ? 'default' : 'muted'}
              numberOfLines={1}
              align="center"
              style={styles.label}
            >
              {option.label}
            </AppText>
            {typeof option.count === 'number' && option.count > 0 ? (
              <View style={[styles.count, { backgroundColor: theme.colors.primaryFill }]}>
                <AppText variant="tiny" color="onPrimary" tabular>
                  {option.count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: t.radii.md - 2,
    backgroundColor: t.colors.surface,
    gap: t.spacing.xxs,
  },
  trackSmall: {
    borderRadius: t.radii.sm,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xs + 2,
    minHeight: SEGMENT_HEIGHT.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radii.sm,
  },
  segmentSmall: {
    minHeight: SEGMENT_HEIGHT.sm,
    borderRadius: t.radii.xs,
  },
  selected: {
    backgroundColor: t.scheme === 'light' ? t.colors.background : t.colors.surfacePressed,
    ...(t.scheme === 'light' ? t.shadows.sm : null),
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    flexShrink: 1,
  },
  count: {
    minWidth: 18,
    height: 18,
    borderRadius: t.radii.pill,
    paddingHorizontal: t.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
