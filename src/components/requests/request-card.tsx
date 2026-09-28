import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { StatusTone } from '@/constants/tones';
import { isTimeCriticalUrgency } from '@/constants/urgency-levels';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CustomerRequestView, ProfessionalRequestView } from '@/types/domain';

import { CategoryIcon } from '../categories/category-icon';
import { AppText } from '../ui/app-text';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useNow } from '../ui/value-text';
import { getRequestStatusLine } from './request-status-line';
import { UrgencyBadge } from './status-badges';

interface RequestCardBaseProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface CustomerRequestCardProps extends RequestCardBaseProps {
  variant: 'customer';
  request: CustomerRequestView;
  /** Unseen offers (computed by the caller, e.g. `latestOfferAt` > last visit): a small dot. */
  hasNewOffers?: boolean;
  /** The booked appointment, when known: the status line reads "Booked · Tue 10:00". */
  appointmentAt?: string | null;
  /** Replaces the computed status line (e.g. "Rate CoolAir HVAC"). */
  statusLine?: { label: string; tone?: StatusTone };
}

interface ProfessionalRequestCardProps extends RequestCardBaseProps {
  variant: 'professional';
  request: ProfessionalRequestView;
}

type RequestCardProps = CustomerRequestCardProps | ProfessionalRequestCardProps;

/** The customer card's status line: text and tone. */
function useCustomerStatusLine(props: CustomerRequestCardProps): { label: string; tone: StatusTone } {
  const { t } = useTranslation('common');
  const format = useFormatters();
  const line = getRequestStatusLine(props.request);
  if (props.statusLine) return { label: props.statusLine.label, tone: props.statusLine.tone ?? line.tone };
  switch (line.kind) {
    case 'offersToReview':
      return { label: t('request.statusLine.offersToReview', { count: line.count }), tone: line.tone };
    case 'booked':
      return {
        label: props.appointmentAt
          ? t('request.statusLine.bookedAt', { when: format.dateTime(props.appointmentAt) })
          : t('request.statusLine.booked'),
        tone: line.tone,
      };
    default:
      return { label: t(`request.statusLine.${line.kind}`), tone: line.tone };
  }
}

/**
 * Compact request summary for lists.
 * - `customer`: category icon + name, a one-line description and one status line in its tone
 *   ("3 offers to review", "Waiting for offers", "Booked · Tue 10:00"…).
 * - `professional`: category, a one-line description, then "distance · posted" with small pills at
 *   its end: the urgency (emergency/urgent only) and "Offered" once the professional sent an offer.
 */
export function RequestCard(props: RequestCardProps) {
  return props.variant === 'customer' ? <CustomerRequestCard {...props} /> : <ProfessionalRequestCard {...props} />;
}

function CustomerRequestCard(props: CustomerRequestCardProps) {
  const { request, onPress, hasNewOffers = false, style, testID } = props;
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const categoryName = useCategoryName(request.categoryId) || t('category.unknown');
  const status = useCustomerStatusLine(props);

  return (
    <Card
      onPress={onPress}
      style={style}
      testID={testID}
      accessibilityLabel={[categoryName, status.label, hasNewOffers ? t('request.newOffers') : null].filter(Boolean).join(', ')}
      padding="none"
    >
      <View style={styles.row}>
        <CategoryIcon categoryId={request.categoryId} size="sm" />
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {categoryName}
            </AppText>
            {hasNewOffers ? <View style={[styles.newDot, { backgroundColor: theme.colors.primary }]} testID="request-card-new" /> : null}
          </View>
          <AppText variant="caption" color="secondary" numberOfLines={1} userContent>
            {request.description}
          </AppText>
          <AppText variant="captionStrong" color={theme.colors.tones[status.tone].fg} numberOfLines={1} style={styles.status}>
            {status.label}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

function ProfessionalRequestCard({ request, onPress, style, testID }: ProfessionalRequestCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const now = useNow(60_000);
  const categoryName = useCategoryName(request.categoryId) || t('category.unknown');
  const offerLabel = request.myOffer
    ? request.myOffer.status === 'pending'
      ? t('request.offered')
      : t(`offerStatus.${request.myOffer.status}`)
    : null;
  const meta = [format.distance(request.distanceKm), format.relative(request.publishedAt ?? request.createdAt, now)].join(' · ');

  return (
    <Card
      onPress={onPress}
      style={style}
      testID={testID}
      accessibilityLabel={[categoryName, t(`urgency.${request.urgency}.label`), meta, offerLabel].filter(Boolean).join(', ')}
      padding="none"
    >
      <View style={styles.row}>
        <CategoryIcon categoryId={request.categoryId} size="sm" />
        <View style={styles.texts}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {categoryName}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1} userContent>
            {request.description}
          </AppText>
          <View style={[styles.titleRow, styles.status]}>
            <AppText variant="caption" color="muted" numberOfLines={1} style={styles.flex}>
              {meta}
            </AppText>
            {isTimeCriticalUrgency(request.urgency) ? <UrgencyBadge level={request.urgency} size="sm" /> : null}
            {offerLabel ? <Badge label={offerLabel} tone="brand" size="sm" testID="request-card-offered" /> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

/** Placeholder with the exact RequestCard layout. */
export function RequestCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <Card padding="none" style={style}>
      <View style={styles.row}>
        <Skeleton width={36} height={36} radius={10} />
        <View style={[styles.texts, styles.skeletonTexts]}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="85%" height={11} />
          <Skeleton width="35%" height={11} />
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    padding: t.spacing.lg,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  status: {
    marginTop: t.spacing.xs,
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
}));
