import { useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { Review } from '@/types/domain';
import { alignForText } from '@/utils/bidi';

import { AppText } from '../ui/app-text';
import { Avatar } from '../ui/avatar';
import { Card } from '../ui/card';
import { RatingStars } from '../ui/rating';

interface ReviewCardProps {
  review: Review;
  /** Show the reviewed service category after the date. */
  showCategory?: boolean;
  /**
   * Leave out the reviewer's avatar and name (stars, date and comment only) – for a review shown
   * where the author is obvious, e.g. the viewer's own review on the job.
   */
  hideAuthor?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Lines shown before "Show more". */
const COLLAPSED_LINES = 3;
/** Rough threshold above which a comment likely exceeds the collapsed lines. */
const LONG_COMMENT_CHARS = 140;

/**
 * Customer review with rating, date and an expandable comment. The comment is aligned by its own
 * language (an English comment reads left-aligned in the Hebrew UI), like chat messages.
 */
export function ReviewCard({
  review,
  showCategory = false,
  hideAuthor = false,
  style,
}: ReviewCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const categoryName = useCategoryName(showCategory ? review.categoryId : null);
  const [expanded, setExpanded] = useState(false);
  const comment = review.comment?.trim() ?? '';
  const expandable = comment.length > LONG_COMMENT_CHARS;

  // Date first: a long category name is what gets truncated, never the date.
  const meta = [format.date(review.createdAt, 'dayMonth'), showCategory ? categoryName || t('category.unknown') : null]
    .filter(Boolean)
    .join(' · ');
  const metaRow = (
    <View style={styles.metaRow}>
      <RatingStars value={review.rating} size={hideAuthor ? 15 : 13} />
      <AppText variant="caption" color="muted" numberOfLines={1} style={styles.shrink}>
        {meta}
      </AppText>
    </View>
  );

  return (
    <Card style={style}>
      {hideAuthor ? (
        metaRow
      ) : (
        <View style={styles.header}>
          <Avatar name={review.customerDisplayName} uri={review.customerAvatarUrl} size="sm" decorative />
          <View style={styles.texts}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {review.customerDisplayName}
            </AppText>
            {metaRow}
          </View>
        </View>
      )}
      {comment ? (
        <>
          <AppText
            variant="body"
            color="secondary"
            align={alignForText(comment, theme.isRTL)}
            numberOfLines={expanded ? undefined : COLLAPSED_LINES}
            style={styles.comment}
            testID="review-comment"
          >
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  shrink: {
    flexShrink: 1,
  },
  comment: {
    marginTop: t.spacing.md,
  },
  toggle: {
    alignSelf: 'flex-start',
    marginTop: t.spacing.xs,
    minHeight: 28,
    justifyContent: 'center',
  },
}));
