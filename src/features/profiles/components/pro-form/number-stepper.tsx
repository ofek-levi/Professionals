/** Numeric − value + control (years of experience). */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Field, IconButton } from '@/components/ui';
import { makeStyles } from '@/theme';

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Renders the value (e.g. "12 years"). */
  formatValue: (value: number) => string;
  error?: string | null;
  testID?: string;
}

export function NumberStepper({ label, value, onChange, min, max, formatValue, error, testID }: NumberStepperProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <Field label={label} error={error}>
      <View
        style={styles.row}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: formatValue(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onChange(clamp(value + 1));
          if (event.nativeEvent.actionName === 'decrement') onChange(clamp(value - 1));
        }}
        testID={testID}
      >
        <IconButton
          icon="minus"
          size="lg"
          color="primary"
          accessibilityLabel={t('a11y.decrease')}
          disabled={value <= min}
          onPress={() => onChange(clamp(value - 1))}
        />
        <AppText variant="heading" align="center" tabular style={styles.value}>
          {formatValue(value)}
        </AppText>
        <IconButton
          icon="plus"
          size="lg"
          color="primary"
          accessibilityLabel={t('a11y.increase')}
          disabled={value >= max}
          onPress={() => onChange(clamp(value + 1))}
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
    padding: t.spacing.xs,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surface,
  },
  value: {
    flex: 1,
  },
}));
