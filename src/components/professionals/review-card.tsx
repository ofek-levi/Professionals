import { useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { Review } from '@/types/domain';

import { CategoryName } from '../categories/category-name';
import { AppText } from '../ui/app-text';
import { Avatar } from '../ui/avatar';
import { Card, type CardVariant } from '../ui/card';
import { RatingStars } from '../ui/rating';

export interface ReviewCardProps {
  review: Review;
  /** Show the reviewed service category under the name. */
  showCategory?: boolean;
  /** Lines shown before "Show more" (default 4). */
  collapsedLines?: number;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

/** Rough threshold above which a comment likely exceeds the collapsed lines. */
const LONG_COMMENT_CHARS = 180;

/** Customer review with rating, date and an expandable comment. */
export function ReviewCard({ review, showCategory = false, collapsedLines = 4, variant = 'outlined', style }: ReviewCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const [expanded, setExpanded] = useState(false);
  const comment = review.comment?.trim() ?? '';
  const expandable = comment.length > LONG_COMMENT_CHARS;

  return (
    <Card variant={variant} style={style}>
      <View style={styles.header}>
        <Avatar name={review.customerDisplayName} uri={review.customerAvatarUrl} size="sm" decorative />
        <View style={styles.texts}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {review.customerDisplayName}
          </AppText>
          {showCategory ? <CategoryName categoryId={review.categoryId} variant="caption" color="muted" numberOfLines={1} /> : null}
        </View>
        <AppText variant="caption" color="muted">
          {format.date(review.createdAt, 'dayMonth')}
        </AppText>
      </View>
      <RatingStars value={review.rating} size={15} style={styles.rating} />
      {comment ? (
        <>
          <AppText variant="body" color="secondary" numberOfLines={expanded ? undefined : collapsedLines}>
            {comment}
          </AppText>
          {expandable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((value) => !value)}
              hitSlop={10}
              style={styles.toggle}
            >
              <AppText variant="captionStrong" color="primary">
                {expanded ? t('actions.showLess') : t('actions.showMore')}
              </AppText>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  rating: {
    marginTop: t.spacing.md,
    marginBottom: t.spacing.sm,
  },
  toggle: {
    alignSelf: 'flex-start',
    marginTop: t.spacing.xs,
    minHeight: 28,
    justifyContent: 'center',
  },
}));
