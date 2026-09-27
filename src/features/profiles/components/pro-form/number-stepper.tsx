/** Numeric − value + control (years of experience, radius fine tuning). */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Field, IconButton } from '@/components/ui';
import { makeStyles } from '@/theme';

export interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Renders the value (e.g. "12 years"). */
  formatValue: (value: number) => string;
  helperText?: string;
  error?: string | null;
  testID?: string;
}

export function NumberStepper({ label, value, onChange, min, max, step = 1, formatValue, helperText, error, testID }: NumberStepperProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <Field label={label} helperText={helperText} error={error}>
      <View
        style={styles.row}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: formatValue(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onChange(clamp(value + step));
          if (event.nativeEvent.actionName === 'decrement') onChange(clamp(value - step));
        }}
        testID={testID}
      >
        <IconButton
          icon="minus"
          variant="soft"
          tone="brand"
          size="lg"
          accessibilityLabel={t('a11y.decrease')}
          disabled={value <= min}
          onPress={() => onChange(clamp(value - step))}
        />
        <AppText variant="heading" align="center" tabular style={styles.value}>
          {formatValue(value)}
        </AppText>
        <IconButton
          icon="plus"
          variant="soft"
          tone="brand"
          size="lg"
          accessibilityLabel={t('a11y.increase')}
          disabled={value >= max}
          onPress={() => onChange(clamp(value + step))}
        />
      </View>
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.sm,
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  value: {
    flex: 1,
  },
}));
