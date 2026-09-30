import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '@/theme';

import { AppSwitch } from './app-switch';
import { AppText } from './app-text';
import { haptics } from './haptics';

interface SwitchRowProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Settings-style row with a trailing switch; the whole row is the touch target. */
export function SwitchRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
}: SwitchRowProps) {
  const styles = useStyles();

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
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={toggle}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null, disabled ? styles.disabled : null, style]}
    >
      <View style={styles.texts}>
        <AppText variant="body">{title}</AppText>
        {description ? (
          <AppText variant="caption" color="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <AppSwitch value={value} onValueChange={toggle} disabled={disabled} decorative />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 52,
    paddingVertical: t.spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
}));
