import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';

export interface StepperProps {
  /** Step titles (already translated). */
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Hide the "Step x of y · Title" caption. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Wizard progress: segmented bar + "Step 2 of 4 · Location". */
export function Stepper({ steps, current, compact = false, style }: StepperProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const total = steps.length;
  const index = Math.min(Math.max(current, 0), Math.max(total - 1, 0));
  const caption = t('stepper.stepOf', { current: index + 1, total });

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${caption}, ${steps[index] ?? ''}`}
      accessibilityValue={{ min: 1, max: total, now: index + 1 }}
    >
      <View style={styles.bars}>
        {steps.map((step, stepIndex) => (
          <View
            key={`${stepIndex}-${step}`}
            style={[
              styles.bar,
              {
                backgroundColor: stepIndex <= index ? theme.colors.primary : theme.colors.border,
                opacity: stepIndex < index ? 0.55 : 1,
              },
            ]}
          />
        ))}
      </View>
      {!compact ? (
        <View style={styles.captionRow}>
          <AppText variant="label" color="primary">
            {caption}
          </AppText>
          <AppText variant="label" color="muted" numberOfLines={1} style={styles.title}>
            {steps[index] ?? ''}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.sm,
  },
  bars: {
    flexDirection: 'row',
    gap: t.spacing.xs + 2,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: t.radii.pill,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  title: {
    flex: 1,
  },
}));
