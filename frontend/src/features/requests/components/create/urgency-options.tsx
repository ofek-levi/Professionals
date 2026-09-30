import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, haptics } from '@/components/ui';
import { URGENCY_LEVELS, type UrgencyLevel } from '@/constants/urgency-levels';
import { makeStyles, useTheme } from '@/theme';

interface UrgencyOptionsProps {
  value: UrgencyLevel | null;
  onChange: (level: UrgencyLevel) => void;
}

/** Four compact choices in one row: "Emergency · Right now" … "Flexible · Any time". */
export function UrgencyOptions({ value, onChange }: UrgencyOptionsProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['requests', 'common']);

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {URGENCY_LEVELS.map((level) => {
        const selected = value === level;
        const label = t(`common:urgency.${level}.label`);
        const hint = t(`requests:form.urgencyHints.${level}`);
        return (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityLabel={`${label}, ${hint}`}
            aria-checked={selected}
            onPress={() => {
              haptics.selection();
              onChange(level);
            }}
            testID={`urgency-option-${level}`}
            style={({ pressed }) => [
              styles.option,
              selected ? { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary } : null,
              pressed && !selected ? styles.pressed : null,
            ]}
          >
            <AppText variant="captionStrong" color={selected ? 'primary' : 'default'} align="center" numberOfLines={1}>
              {label}
            </AppText>
            <AppText variant="label" color={selected ? 'primary' : 'muted'} align="center" numberOfLines={1}>
              {hint}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  option: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: t.spacing.xs,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.md,
    borderWidth: 1.5,
    borderColor: t.colors.surface,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.xxs,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
    borderColor: t.colors.surfacePressed,
  },
}));
