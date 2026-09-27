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

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** iOS-style segmented switch for 2–4 mutually exclusive views or filters. */
export function SegmentedControl<T extends string>({ options, value, onChange, size = 'md', style, testID }: SegmentedControlProps<T>) {
  const theme = useTheme();
  const styles = useStyles();
  const small = size === 'sm';

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
              color={selected ? 'default' : 'secondary'}
              numberOfLines={1}
              align="center"
              style={styles.label}
            >
              {option.label}
            </AppText>
            {typeof option.count === 'number' && option.count > 0 ? (
              <View style={[styles.count, { backgroundColor: selected ? theme.colors.primary : theme.colors.borderStrong }]}>
                <AppText variant="tiny" color={selected ? 'onPrimary' : 'default'} tabular>
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
    padding: t.spacing.xxs + 1,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: t.colors.border,
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
    minHeight: 40,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radii.sm + 2,
  },
  segmentSmall: {
    minHeight: 32,
    borderRadius: t.radii.xs,
  },
  selected: {
    backgroundColor: t.colors.surface,
    ...(t.scheme === 'light' ? t.shadows.sm : { borderWidth: 1, borderColor: t.colors.borderStrong }),
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
