import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/theme';

import { withAlpha } from './colors';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Corner radius; defaults to `t.radii.xs` (or fully round with `circle`). */
  radius?: number;
  /** Renders a circle of `height` × `height`. */
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SHIMMER_DURATION_MS = 1300;

/** Placeholder block with a soft shimmer sweeping from the start edge (respects Reduce Motion). */
export function Skeleton({ width = '100%', height = 14, radius, circle = false, style }: SkeletonProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const progress = useSharedValue(0);
  const direction = theme.isRTL ? -1 : 1;

  useEffect(() => {
    if (reduceMotion) return undefined;
    progress.set(withRepeat(withTiming(1, { duration: SHIMMER_DURATION_MS, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  // The band starts fully outside the start edge and ends fully outside the end edge.
  const bandWidth = layoutWidth * 0.6;
  const shimmerStyle = useAnimatedStyle(() => {
    return { transform: [{ translateX: direction * (-bandWidth + progress.get() * (layoutWidth + bandWidth)) }] };
  }, [layoutWidth, bandWidth, direction]);

  const highlight = withAlpha(theme.colors.surface, theme.scheme === 'dark' ? 0.12 : 0.65);
  const transparent = withAlpha(theme.colors.surface, 0);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setLayoutWidth(event.nativeEvent.layout.width)}
      style={[
        {
          width: circle ? height : width,
          height,
          borderRadius: circle ? height / 2 : (radius ?? theme.radii.xs),
          backgroundColor: theme.colors.skeleton,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {layoutWidth > 0 && !reduceMotion ? (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: bandWidth }, shimmerStyle]}>
          <LinearGradient
            colors={[transparent, highlight, transparent]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export interface SkeletonCardProps {
  /** Show a leading avatar/icon placeholder. Defaults to `true`. */
  withAvatar?: boolean;
  /** Number of paragraph lines. */
  lines?: number;
  style?: StyleProp<ViewStyle>;
}

/** Card-shaped placeholder matching the domain cards (RequestCard, JobCard…). */
export function SkeletonCard({ withAvatar = true, lines = 2, style }: SkeletonCardProps) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        {withAvatar ? <Skeleton circle height={40} /> : null}
        <View style={styles.flex}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="35%" height={11} />
        </View>
        <Skeleton width={72} height={22} radius={999} />
      </View>
      <View style={styles.lines}>
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} width={index === lines - 1 ? '70%' : '100%'} height={12} />
        ))}
      </View>
      <View style={styles.row}>
        <Skeleton width={90} height={20} radius={999} />
        <Skeleton width={70} height={20} radius={999} />
      </View>
    </View>
  );
}

export interface SkeletonListProps {
  count?: number;
  variant?: 'card' | 'row';
  style?: StyleProp<ViewStyle>;
}

/** Loading placeholder for lists; announces "Loading…" once for screen readers. */
export function SkeletonList({ count = 3, variant = 'card', style }: SkeletonListProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  return (
    <View style={[styles.list, style]} accessible accessibilityRole="progressbar" accessibilityLabel={t('states.loading')}>
      {Array.from({ length: count }, (_, index) =>
        variant === 'card' ? (
          <SkeletonCard key={index} />
        ) : (
          <View key={index} style={styles.listRow}>
            <Skeleton height={40} width={40} radius={10} />
            <View style={styles.flex}>
              <Skeleton width="60%" height={13} />
              <Skeleton width="40%" height={11} />
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
    gap: t.spacing.sm,
  },
  lines: {
    gap: t.spacing.sm,
  },
  list: {
    gap: t.spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
}));
