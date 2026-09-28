import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/theme';

interface StepProgressProps {
  /** 1-based number of the current step. */
  step: number;
  /** Number of steps in the flow. */
  total: number;
  testID?: string;
}

/** How long the bar takes to glide to the new step. */
const FILL_DURATION_MS = 420;

/**
 * "Step 2 of 4" above a slim progress bar. The bar starts empty and glides to the current share,
 * then animates again whenever the step or the number of steps changes (instant with reduced motion).
 */
export function StepProgress({ step, total, testID }: StepProgressProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const reduceMotion = useReducedMotion();
  const label = t('signUp.progress', { step, total });
  const share = total > 0 ? Math.min(1, Math.max(0, step / total)) : 0;

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(reduceMotion ? share : withTiming(share, { duration: FILL_DURATION_MS, easing: Easing.out(Easing.cubic) }));
  }, [fill, share, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: step, text: label }}
      style={styles.container}
      testID={testID}
    >
      <AppText variant="captionStrong" color="secondary">
        {label}
      </AppText>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
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
