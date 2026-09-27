import { Pressable, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon, type IconSource } from './icon';

export interface SwitchRowProps {
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
export function SwitchRow({ title, description, value, onValueChange, icon, iconTone = 'brand', disabled = false, style, testID }: SwitchRowProps) {
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
      <Switch
        value={value}
        onValueChange={toggle}
        disabled={disabled}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
        thumbColor={theme.colors.onPrimary}
        ios_backgroundColor={theme.colors.borderStrong}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
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
