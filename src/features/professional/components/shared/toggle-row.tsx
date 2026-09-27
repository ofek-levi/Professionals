/**
 * RTL-safe switch controls for the professional screens.
 *
 * Workaround: on react-native-web the `Switch` thumb mixes physical and logical offsets, so with a
 * live `<html dir="rtl">` switch the "on" thumb is drawn outside the track. Rendering the switch in
 * an LTR island on the web keeps the thumb inside (native switches mirror correctly on their own).
 * Same look and API as the shared `SwitchRow`, which has the same web issue.
 */
import { Platform, Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, haptics, Icon, type IconSource } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

const WEB_LTR: ViewStyle | null = Platform.OS === 'web' ? { direction: 'ltr' } : null;

export interface RtlSafeSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Hide from screen readers when the surrounding row is the accessible control. */
  decorative?: boolean;
}

export function RtlSafeSwitch({ value, onValueChange, disabled, accessibilityLabel, decorative = false }: RtlSafeSwitchProps) {
  const theme = useTheme();
  return (
    <View style={WEB_LTR}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
        thumbColor={theme.colors.onPrimary}
        ios_backgroundColor={theme.colors.borderStrong}
        accessibilityElementsHidden={decorative}
        importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      />
    </View>
  );
}

export interface ToggleRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: IconSource;
  iconTone?: StatusTone;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Settings-style row with a trailing switch; the whole row is the touch target. */
export function ToggleRow({ title, description, value, onValueChange, icon, iconTone = 'brand', disabled = false, style, testID }: ToggleRowProps) {
  const theme = useTheme();
  const styles = useStyles();
  const tone = theme.colors.tones[iconTone];
  const toggle = () => {
    if (disabled) return;
    haptics.selection();
    onValueChange(!value);
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={toggle}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
    >
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
          <Icon name={icon} size={20} color={tone.fg} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <AppText variant="bodyStrong">{title}</AppText>
        {description ? (
          <AppText variant="caption" color="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <RtlSafeSwitch value={value} onValueChange={toggle} disabled={disabled} decorative />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 56,
    paddingVertical: t.spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: t.radii.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
}));
