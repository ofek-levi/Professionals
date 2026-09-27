/** Compact summary of the request being quoted, with the urgency guidance for the proposed time. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { PreferredScheduleText, UrgencyBadge } from '@/components/requests';
import { AppText, Card, DistanceText, Icon } from '@/components/ui';
import { URGENCY_META } from '@/constants/urgency-levels';
import { OFFER_TIME_RULES } from '@/features/offers/offer-rules';
import { useCategoryName } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { ProfessionalRequestView } from '@/types/domain';

import { urgencyWindowHours } from './offer-form-model';

export function RequestSummaryHeader({ request, onPress }: { request: ProfessionalRequestView; onPress: () => void }) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation(['offers', 'common']);
  const categoryName = useCategoryName(request.categoryId) || t('common:category.unknown');
  const windowHours = urgencyWindowHours(request.urgency);
  const tone = URGENCY_META[request.urgency].tone;
  const colors = theme.colors.tones[tone];
  const guidance =
    windowHours !== null
      ? t('offers:form.guidance.window', { hours: windowHours, urgency: t(`common:urgency.${request.urgency}.label`) })
      : t('offers:form.guidance.flexible', { days: OFFER_TIME_RULES.maxDaysAhead });

  return (
    <Card variant="elevated" padding="none" onPress={onPress} accessibilityHint={t('offers:form.viewRequestHint')} testID="offer-form-request">
      <View style={styles.body}>
        <View style={styles.row}>
          <CategoryIcon categoryId={request.categoryId} size="md" />
          <View style={styles.flex}>
            <AppText variant="subheading" numberOfLines={1}>
              {categoryName}
            </AppText>
            <AppText variant="caption" color="secondary" numberOfLines={2}>
              {request.description}
            </AppText>
          </View>
          <Icon name="chevron-right" size={20} color="muted" flipInRTL />
        </View>
        <View style={styles.meta}>
          <UrgencyBadge level={request.urgency} size="sm" />
          <PreferredScheduleText schedule={request.preferredSchedule} />
          <DistanceText km={request.distanceKm} away />
        </View>
      </View>
      <View style={[styles.guidance, { backgroundColor: colors.bg }]}>
        <Icon name={URGENCY_META[request.urgency].icon} size={18} color={colors.fg} />
        <AppText variant="caption" color={colors.fg} style={styles.flex}>
          {guidance}
        </AppText>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  body: {
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
    gap: t.spacing.xxs,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: t.spacing.md,
    rowGap: t.spacing.sm,
  },
  guidance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderBottomStartRadius: t.radii.lg,
    borderBottomEndRadius: t.radii.lg,
  },
}));
