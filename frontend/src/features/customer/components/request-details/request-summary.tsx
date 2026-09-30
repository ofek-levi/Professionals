import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryName } from '@/components/categories';
import { getRequestStatusLine, PhotoStrip } from '@/components/requests';
import { AppText, Skeleton, useNow } from '@/components/ui';
import { useFormatters, usePersonName } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CustomerRequestView, JobDetails } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

/** Descriptions longer than this are clamped with "Show more". */
const LONG_DESCRIPTION_CHARS = 180;
const DESCRIPTION_PREVIEW_LINES = 4;

interface RequestSummaryProps {
  request: CustomerRequestView;
  /** The job once an offer was accepted (names the pro in the status line). */
  job: JobDetails | undefined;
}

/** Status first: category, one status sentence, the description, one meta line and the photos. */
export function RequestSummary({ request, job }: RequestSummaryProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const format = useFormatters();
  const personName = usePersonName();
  const now = useNow(60_000);
  const [expanded, setExpanded] = useState(false);
  const status = getRequestStatusLine(request);
  const proName = job ? isolateText(personName(job.professional)) : null;
  const toneColor = theme.colors.tones[status.tone].fg;

  let statusText: string;
  let statusHint: string | null = null;
  switch (status.kind) {
    case 'draft':
      statusText = t('customer:details.status.draft');
      break;
    case 'waitingForOffers':
      statusText = t('customer:details.status.waiting');
      // Who got it, from the server's count (`null` = still being counted right after posting).
      statusHint =
        request.matchedProfessionalCount === null
          ? null
          : request.matchedProfessionalCount === 0
            ? t('customer:details.status.waitingNoPros')
            : t('customer:details.status.waitingHint', { count: request.matchedProfessionalCount });
      break;
    case 'offersToReview':
      statusText = t('customer:details.status.offersToReview', { count: status.count });
      break;
    case 'booked':
      statusText = proName ? t('customer:details.status.booked', { name: proName }) : t('customer:details.status.bookedPending');
      break;
    case 'inProgress':
      statusText = proName ? t('customer:details.status.inProgress', { name: proName }) : t('common:request.statusLine.inProgress');
      break;
    case 'completed':
      statusText = proName ? t('customer:details.status.completed', { name: proName }) : t('customer:details.status.completedPending');
      break;
    case 'cancelled':
      statusText = t('customer:details.status.cancelled');
      statusHint = request.cancellationReason ? t(`common:cancellationReason.${request.cancellationReason}`) : null;
      break;
  }

  const isDraft = request.status === 'draft';
  const since = request.publishedAt ?? request.createdAt;
  const meta = [
    t(`common:urgency.${request.urgency}.label`),
    isDraft
      ? t('customer:details.saved', { time: format.relative(request.updatedAt, now, { casing: 'inline' }) })
      : t('customer:details.posted', { time: format.relative(since, now, { casing: 'inline' }) }),
    request.location.neighborhood ?? request.location.city,
  ]
    .filter(Boolean)
    .join(' · ');

  const description = request.description.trim();
  const long = description.length > LONG_DESCRIPTION_CHARS;

  return (
    <View style={styles.container} testID="request-summary">
      <View style={styles.titleBlock}>
        <CategoryName categoryId={request.categoryId} variant="title" numberOfLines={2} accessibilityRole="header" />
        <AppText variant="subheading" color={toneColor} testID="request-status">
          {statusText}
          {statusHint ? (
            <AppText variant="body" color="secondary">
              {` · ${statusHint}`}
            </AppText>
          ) : null}
        </AppText>
      </View>

      <View style={styles.descriptionBlock}>
        <AppText variant="body" numberOfLines={expanded || !long ? undefined : DESCRIPTION_PREVIEW_LINES} selectable userContent>
          {description}
        </AppText>
        {long ? (
          <Pressable
            accessibilityRole="button"
            aria-expanded={expanded}
            onPress={() => setExpanded((value) => !value)}
            hitSlop={10}
            style={styles.more}
          >
            <AppText variant="captionStrong" color="primary">
              {expanded ? t('common:actions.showLess') : t('common:actions.showMore')}
            </AppText>
          </Pressable>
        ) : null}
        <AppText variant="caption" color="muted" numberOfLines={2}>
          {meta}
        </AppText>
      </View>

      {request.photos.length > 0 ? <PhotoStrip photos={request.photos} size={72} /> : null}
    </View>
  );
}

/** Placeholder with the summary's layout. */
export function RequestSummarySkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Skeleton width="50%" height={24} />
        <Skeleton width="40%" height={16} />
      </View>
      <View style={styles.descriptionBlock}>
        <Skeleton width="100%" height={14} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="60%" height={12} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xl,
    paddingTop: t.spacing.sm,
  },
  titleBlock: {
    gap: t.spacing.xs,
  },
  descriptionBlock: {
    gap: t.spacing.sm,
  },
  more: {
    alignSelf: 'flex-start',
  },
}));
