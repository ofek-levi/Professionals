import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Button, Icon, RatingStars, type IconSource } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

export interface ReviewResultStateProps {
  icon: IconSource;
  tone: StatusTone;
  title: string;
  description: string;
  /** Rating shown under the illustration (success state). */
  rating?: number;
  /** Extra content, e.g. the submitted review. */
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  testID?: string;
}

/** Full-screen outcome of the review flow: thank-you, already reviewed, not available. */
export function ReviewResultState({
  icon,
  tone,
  title,
  description,
  rating,
  children,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  testID,
}: ReviewResultStateProps) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = theme.colors.tones[tone];

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.illustration} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.outerRing, { backgroundColor: colors.bg }]}>
          <View style={[styles.innerCircle, { backgroundColor: colors.solid }]}>
            <Icon name={icon} size={44} color={theme.colors.onPrimary} />
          </View>
        </View>
        <Icon name="star-four-points" size={22} color={theme.colors.star} style={styles.sparkleTop} />
        <Icon name="star-four-points-outline" size={16} color={colors.solid} style={styles.sparkleBottom} />
        <Icon name="circle-medium" size={18} color={theme.colors.primary} style={styles.sparkleSide} />
      </View>
      <View style={styles.texts}>
        <AppText variant="title" align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" color="secondary" align="center">
          {description}
        </AppText>
        {typeof rating === 'number' ? <RatingStars value={rating} size={22} style={styles.rating} /> : null}
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
      <View style={styles.actions}>
        <Button label={primaryLabel} onPress={onPrimary} size="lg" fullWidth testID="review-result-primary" />
        {secondaryLabel && onSecondary ? (
          <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" size="lg" fullWidth testID="review-result-secondary" />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: t.spacing.xl,
    paddingVertical: t.spacing.xxxl,
  },
  illustration: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadows.md,
  },
  sparkleTop: {
    position: 'absolute',
    top: 6,
    end: 14,
  },
  sparkleBottom: {
    position: 'absolute',
    bottom: 12,
    start: 10,
  },
  sparkleSide: {
    position: 'absolute',
    top: 40,
    start: 0,
  },
  texts: {
    alignItems: 'center',
    gap: t.spacing.sm,
    maxWidth: 360,
  },
  rating: {
    marginTop: t.spacing.sm,
  },
  content: {
    alignSelf: 'stretch',
  },
  actions: {
    alignSelf: 'stretch',
    gap: t.spacing.xs,
  },
}));
