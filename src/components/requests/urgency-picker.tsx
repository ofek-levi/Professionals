import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { URGENCY_LEVELS, URGENCY_META, type UrgencyLevel } from '@/constants/urgency-levels';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from '../ui/app-text';
import { haptics } from '../ui/haptics';
import { Icon } from '../ui/icon';

export interface UrgencyPickerProps {
  value: UrgencyLevel | null;
  onChange: (level: UrgencyLevel) => void;
  /** Subset/order of levels (defaults to all, most urgent first). */
  levels?: readonly UrgencyLevel[];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Four selectable cards (icon, label, description) with radio semantics. */
export function UrgencyPicker({ value, onChange, levels = URGENCY_LEVELS, disabled = false, style }: UrgencyPickerProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');

  return (
    <View style={[styles.list, style]} accessibilityRole="radiogroup">
      {levels.map((level) => {
        const meta = URGENCY_META[level];
        const tone = theme.colors.tones[meta.tone];
        const selected = value === level;
        const label = t(`urgency.${level}.label`);
        const description = t(`urgency.${level}.description`);
        return (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityLabel={`${label}, ${description}`}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            onPress={() => {
              haptics.selection();
              onChange(level);
            }}
            testID={`urgency-option-${level}`}
            style={({ pressed }) => [
              styles.card,
              selected ? { borderColor: tone.solid, backgroundColor: tone.bg } : null,
              pressed && !selected ? styles.pressed : null,
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: selected ? tone.solid : tone.bg }]}>
              <Icon name={meta.icon} size={22} color={selected ? theme.colors.onPrimary : tone.fg} />
            </View>
            <View style={styles.texts}>
              <AppText variant="bodyStrong" color={selected ? tone.fg : 'default'}>
                {label}
              </AppText>
              <AppText variant="caption" color="secondary">
                {description}
              </AppText>
            </View>
            <View style={[styles.radio, selected ? { borderColor: tone.solid } : null]}>
              {selected ? <View style={[styles.radioDot, { backgroundColor: tone.solid }]} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  list: {
    gap: t.spacing.sm + 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 72,
    padding: t.spacing.md + 2,
    borderRadius: t.radii.lg,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: t.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
}));
