import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme, type TypographyVariant } from '@/theme';
import { RATING_VALUES, type Rating } from '@/types/domain';

import { AppText } from './app-text';
import { haptics } from './haptics';
import { Icon, type IconName } from './icon';

export interface RatingStarsProps {
  /** 0–5 (rounded to the nearest half); `null` means no reviews yet. */
  value: number | null;
  size?: number;
  /** Shows the numeric value after the stars (`4.8`). */
  showValue?: boolean;
  /** Review count shown as `(128)`. */
  count?: number;
  /** `compact`: a single star + value – for dense cards. */
  variant?: 'stars' | 'compact';
  textVariant?: TypographyVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Verbal label per star value (`common:rating.labels.*`). */
const RATING_LABEL_KEYS = { 1: 'poor', 2: 'fair', 3: 'good', 4: 'veryGood', 5: 'excellent' } as const satisfies Record<Rating, string>;

function starIcon(rounded: number, position: number): IconName {
  if (rounded >= position) return 'star';
  if (rounded >= position - 0.5) return 'star-half-full';
  return 'star-outline';
}

/** Read-only rating display with half-star precision (half stars mirror in RTL). */
export function RatingStars({
  value,
  size = 16,
  showValue = false,
  count,
  variant = 'stars',
  textVariant = 'captionStrong',
  style,
  testID,
}: RatingStarsProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const hasValue = typeof value === 'number' && value > 0;
  const rounded = hasValue ? Math.round(Math.min(5, value) * 2) / 2 : 0;
  const valueText = hasValue ? format.number(value, 1) : t('rating.new');
  const label = hasValue
    ? [t('a11y.rating', { value: format.number(value, 1) }), typeof count === 'number' ? t('counts.reviews', { count }) : null]
        .filter(Boolean)
        .join(', ')
    : t('rating.noReviews');

  return (
    <View style={[styles.row, style]} accessible accessibilityRole="text" accessibilityLabel={label} testID={testID}>
      {variant === 'compact' ? (
        <Icon name={hasValue ? 'star' : 'star-outline'} size={size} color={hasValue ? theme.colors.star : theme.colors.textMuted} />
      ) : (
        <View style={styles.stars}>
          {RATING_VALUES.map((position) => {
            const icon = starIcon(rounded, position);
            return (
              <Icon
                key={position}
                name={icon}
                size={size}
                color={icon === 'star-outline' ? theme.colors.borderStrong : theme.colors.star}
                flipInRTL={icon === 'star-half-full'}
              />
            );
          })}
        </View>
      )}
      {showValue || variant === 'compact' ? (
        <AppText variant={textVariant} color={hasValue ? 'default' : 'muted'} tabular>
          {valueText}
        </AppText>
      ) : null}
      {typeof count === 'number' && hasValue ? (
        <AppText variant={textVariant === 'captionStrong' ? 'caption' : textVariant} color="muted" tabular>
          {`(${format.number(count)})`}
        </AppText>
      ) : null}
    </View>
  );
}

export interface RatingInputProps {
  value: Rating | null;
  onChange: (value: Rating) => void;
  /** Star glyph size (touch targets are always ≥ 48pt). */
  size?: number;
  /** Shows the verbal label ("Excellent") under the stars. Defaults to `true`. */
  showLabel?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Interactive 1–5 star input with large touch targets and radio semantics for screen readers. */
export function RatingInput({ value, onChange, size = 40, showLabel = true, disabled = false, style, testID }: RatingInputProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const target = Math.max(size + 8, theme.layout.minTouchSize);

  return (
    <View style={[styles.inputContainer, style]} testID={testID}>
      <View style={styles.inputRow} accessibilityRole="radiogroup">
        {RATING_VALUES.map((position) => {
          const filled = value !== null && position <= value;
          return (
            <Pressable
              key={position}
              accessibilityRole="radio"
              accessibilityLabel={`${t('rating.stars', { count: position })}, ${t(`rating.labels.${RATING_LABEL_KEYS[position]}`)}`}
              accessibilityState={{ checked: value === position, disabled }}
              disabled={disabled}
              onPress={() => {
                haptics.selection();
                onChange(position);
              }}
              style={({ pressed }) => [
                { width: target, height: target },
                styles.star,
                pressed ? styles.starPressed : null,
              ]}
            >
              <Icon name={filled ? 'star' : 'star-outline'} size={size} color={filled ? theme.colors.star : theme.colors.borderStrong} />
            </Pressable>
          );
        })}
      </View>
      {showLabel ? (
        <AppText variant="subheading" color={value ? 'default' : 'muted'} align="center" accessibilityLiveRegion="polite">
          {value ? t(`rating.labels.${RATING_LABEL_KEYS[value]}`) : t('rating.tapToRate')}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  inputContainer: {
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  starPressed: {
    transform: [{ scale: 0.88 }],
  },
}));
