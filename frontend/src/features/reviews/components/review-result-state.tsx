import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Button, Icon, RatingStars, type IconSource } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

interface ReviewResultStateProps {
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
      <View
        style={[styles.illustration, { backgroundColor: colors.bg }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name={icon} size={40} color={colors.fg} />
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
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
