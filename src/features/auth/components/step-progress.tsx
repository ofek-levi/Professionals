import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/theme';

interface StepProgressProps {
  /** 1-based number of the current step. */
  step: number;
  /** Number of steps, or `null` while it isn't known yet (it depends on an answer still to give). */
  total: number | null;
  /** The longest the flow can be: sizes the bar while `total` is unknown. */
  maxTotal: number;
  testID?: string;
}

/** "Step 2 of 4" (or just "Step 1" while the length is unknown) above a slim progress bar. */
export function StepProgress({ step, total, maxTotal, testID }: StepProgressProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const label = total === null ? t('signUp.progressUnknownTotal', { step }) : t('signUp.progress', { step, total });
  const denominator = total ?? maxTotal;
  const share = denominator > 0 ? Math.min(1, Math.max(0, step / denominator)) : 0;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={total === null ? { text: label } : { min: 1, max: total, now: step, text: label }}
      style={styles.container}
      testID={testID}
    >
      <AppText variant="captionStrong" color="secondary">
        {label}
      </AppText>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share * 100}%` }]} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.sm,
  },
  track: {
    height: 4,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.primary,
  },
}));
