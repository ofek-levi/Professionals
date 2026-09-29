import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

export type ChipSize = 'sm' | 'md';

interface ChipProps {
  label: string;
  selected?: boolean;
  /** Toggle / select handler. Without it (and without `onRemove`) the chip is static. */
  onPress?: () => void;
  /** Shows a trailing close button (e.g. removable filters or selected categories). */
  onRemove?: () => void;
  icon?: IconSource;
  /** Custom leading element (e.g. a small category icon); overrides `icon`. */
  leading?: ReactNode;
  size?: ChipSize;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Selectable filter chip. Selected chips use the primary color; the check icon reinforces state. */
export function Chip({
  label,
  selected = false,
  onPress,
  onRemove,
  icon,
  leading,
  size = 'md',
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const foreground = selected ? theme.colors.primary : theme.colors.text;
  const small = size === 'sm';
  const iconSize = small ? 14 : 16;

  const content = (
    <>
      {leading ?? (icon ? <Icon name={icon} size={iconSize} color={selected ? 'primary' : 'secondary'} /> : null)}
      <AppText variant={small ? 'label' : 'captionStrong'} color={foreground} numberOfLines={1} style={styles.label}>
        {label}
      </AppText>
    </>
  );

  const containerStyle = [
    styles.base,
    small ? styles.small : styles.medium,
    selected ? styles.selected : styles.unselected,
    disabled ? styles.disabled : null,
  ];

  return (
    <View style={[styles.wrapper, style]}>
      {onPress ? (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ selected, disabled }}
          disabled={disabled}
          hitSlop={small ? 8 : 4}
          onPress={() => {
            haptics.selection();
            onPress();
          }}
          style={({ pressed }) => [containerStyle, onRemove ? styles.withRemove : null, pressed ? styles.pressed : null]}
        >
          {content}
        </Pressable>
      ) : (
        <View testID={testID} style={[containerStyle, onRemove ? styles.withRemove : null]} accessible accessibilityLabel={label}>
          {content}
        </View>
      )}
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.removeItem', { name: label })}
          hitSlop={10}
          disabled={disabled}
          onPress={() => {
            haptics.selection();
            onRemove();
          }}
          style={({ pressed }) => [
            styles.remove,
            small ? styles.small : styles.medium,
            selected ? styles.selected : styles.unselected,
            pressed ? styles.pressed : null,
          ]}
        >
          <Icon name="close" size={iconSize} color={selected ? 'primary' : 'secondary'} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrapper: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.radii.pill,
    borderWidth: 1,
    gap: t.spacing.xs + 2,
  },
  small: {
    minHeight: 30,
    paddingHorizontal: t.spacing.md - 2,
  },
  medium: {
    minHeight: 36,
    paddingHorizontal: t.spacing.md + 2,
  },
  selected: {
    backgroundColor: t.colors.primarySoft,
    borderColor: t.colors.primary,
  },
  unselected: {
    backgroundColor: t.colors.background,
    borderColor: t.colors.borderStrong,
  },
  withRemove: {
    borderTopEndRadius: 0,
    borderBottomEndRadius: 0,
    borderEndWidth: 0,
    paddingEnd: t.spacing.xs,
  },
  remove: {
    borderWidth: 1,
    borderStartWidth: 0,
    borderRadius: t.radii.pill,
    borderTopStartRadius: 0,
    borderBottomStartRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.spacing.sm,
  },
  label: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
}));
