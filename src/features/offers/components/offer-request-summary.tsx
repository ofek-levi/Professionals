/** The request an offer belongs to (tap → request details). */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { PreferredScheduleText, RequestStatusBadge, UrgencyBadge } from '@/components/requests';
import { AppText, Card, Icon } from '@/components/ui';
import { useCategoryName } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { OfferWithRequest } from '@/types/domain';

export function OfferRequestSummary({ request, onPress }: { request: OfferWithRequest['request']; onPress: () => void }) {
  const styles = useStyles();
  const { t } = useTranslation(['offers', 'common']);
  const categoryName = useCategoryName(request.categoryId) || t('common:category.unknown');
  const area = [request.location.neighborhood, request.location.city].filter(Boolean).join(', ');
  return (
    <Card onPress={onPress} padding="lg" style={styles.card} accessibilityLabel={`${t('offers:details.request')}: ${categoryName}`} testID="offer-request-summary">
      <View style={styles.row}>
        <CategoryIcon categoryId={request.categoryId} size="md" />
        <View style={styles.flex}>
          <AppText variant="subheading" numberOfLines={1}>
            {categoryName}
          </AppText>
          {area ? (
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {area}
            </AppText>
          ) : null}
        </View>
        <Icon name="chevron-right" size={20} color="muted" flipInRTL />
      </View>
      <AppText variant="body" color="secondary" numberOfLines={3} userContent>
        {request.description}
      </AppText>
      <View style={styles.meta}>
        <UrgencyBadge level={request.urgency} size="sm" />
        <RequestStatusBadge status={request.status} size="sm" />
        <PreferredScheduleText schedule={request.preferredSchedule} />
      </View>
      <View style={styles.inline}>
        <Icon name="tag-multiple-outline" size={15} color="muted" />
        <AppText variant="caption" color="muted">
          {t('common:counts.offers', { count: request.offerCount })}
        </AppText>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: t.spacing.md,
    rowGap: t.spacing.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
}));
