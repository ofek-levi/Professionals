/**
 * Compact preview of the selected request, floating over the bottom of the explore map: category,
 * one line of description, "distance · posted" with small pills (urgency when time-critical,
 * "Offered") and a View button.
 */
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { isTimeCriticalUrgency } from '@/constants/urgency-levels';
import { UrgencyBadge } from '@/components/requests';
import { AppText, Badge, Button, useNow } from '@/components/ui';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { ProfessionalRequestView } from '@/types/domain';

interface MapRequestPreviewProps {
  request: ProfessionalRequestView;
  onOpen: () => void;
}

export function MapRequestPreview({ request, onOpen }: MapRequestPreviewProps) {
  const styles = useStyles();
  const { t } = useTranslation(['explore', 'common']);
  const format = useFormatters();
  const now = useNow(60_000);
  const categoryName = useCategoryName(request.categoryId) || t('common:category.unknown');
  const meta = [format.distance(request.distanceKm), format.relative(request.publishedAt ?? request.createdAt, now)].join(' · ');
  const offered = request.myOffer
    ? request.myOffer.status === 'pending'
      ? t('common:request.offered')
      : t(`common:offerStatus.${request.myOffer.status}`)
    : null;

  // The summary opens the request; "View" is a sibling button, never nested in another button.
  return (
    <View style={styles.card} testID="explore-map-preview">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[categoryName, t(`common:urgency.${request.urgency}.label`), meta, offered].filter(Boolean).join(', ')}
        accessibilityHint={t('explore:preview.openHint')}
        onPress={onOpen}
        style={({ pressed }) => [styles.summary, pressed ? styles.pressed : null]}
        testID="explore-map-preview-summary"
      >
        <View style={styles.titleRow}>
          <CategoryIcon categoryId={request.categoryId} size="sm" />
          <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
            {categoryName}
          </AppText>
        </View>
        <AppText variant="caption" color="secondary" numberOfLines={1} userContent>
          {request.description}
        </AppText>
      </Pressable>
      <View style={styles.footer}>
        <AppText variant="caption" color="muted" numberOfLines={1} style={styles.shrink}>
          {meta}
        </AppText>
        {isTimeCriticalUrgency(request.urgency) ? <UrgencyBadge level={request.urgency} size="sm" /> : null}
        {offered ? <Badge label={offered} tone="brand" size="sm" /> : null}
        <View style={styles.flex} />
        <Button label={t('explore:preview.view')} size="sm" onPress={onOpen} testID="explore-map-preview-open" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.md,
    padding: t.spacing.lg,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surfaceElevated,
    ...t.shadows.lg,
  },
  summary: {
    gap: t.spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
}));
