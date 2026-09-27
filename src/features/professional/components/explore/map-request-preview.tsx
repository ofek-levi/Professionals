/**
 * Compact preview of the selected request, floating over the bottom of the explore map.
 */
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { OfferStatusBadge } from '@/components/offers';
import { UrgencyBadge } from '@/components/requests';
import { AppText, Button, Card, Icon, IconButton, PriceText, TimeAgo } from '@/components/ui';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { ProfessionalRequestView } from '@/types/domain';

export interface MapRequestPreviewProps {
  request: ProfessionalRequestView;
  onOpen: () => void;
  onClose: () => void;
}

/** `IconButton` size `sm` and `CategoryIcon` size `md` (the Close button is centered on the header row). */
const CLOSE_BUTTON_SIZE = 32;
const HEADER_ICON_SIZE = 44;

export function MapRequestPreview({ request, onOpen, onClose }: MapRequestPreviewProps) {
  const styles = useStyles();
  const { t } = useTranslation(['explore', 'common']);
  const format = useFormatters();
  const categoryName = useCategoryName(request.categoryId) || t('common:category.unknown');
  const area = [request.location.neighborhood, request.location.city].filter(Boolean).join(', ');
  const distance = t('explore:preview.approxDistance', { distance: format.distance(request.distanceKm) });

  // The summary opens the request; Close and "View request" are sibling buttons, never nested in
  // another button (screen readers reach them, and web gets no nested role=button).
  return (
    <Card variant="elevated" padding="lg" style={styles.card} testID="explore-map-preview">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[categoryName, t(`common:urgency.${request.urgency}.label`), distance, area].filter(Boolean).join(', ')}
        accessibilityHint={t('explore:preview.openHint')}
        onPress={onOpen}
        style={({ pressed }) => [styles.summary, pressed ? styles.pressed : null]}
        testID="explore-map-preview-summary"
      >
        <View style={styles.header}>
          <CategoryIcon categoryId={request.categoryId} size="md" />
          <View style={styles.headerTexts}>
            <AppText variant="subheading" numberOfLines={1}>
              {categoryName}
            </AppText>
            <View style={styles.metaRow}>
              <TimeAgo date={request.publishedAt ?? request.createdAt} style={styles.noShrink} />
              {area ? (
                <AppText variant="caption" color="muted" numberOfLines={1} style={styles.shrink}>
                  {`· ${area}`}
                </AppText>
              ) : null}
            </View>
          </View>
          {/* Room for the Close button, which sits on top of this row. */}
          <View style={styles.closeSpace} />
        </View>

        <AppText variant="body" color="secondary" numberOfLines={2} userContent>
          {request.description}
        </AppText>

        <View style={styles.badges}>
          <UrgencyBadge level={request.urgency} size="sm" />
          <View style={styles.meta}>
            <Icon name="map-marker-distance" size={15} color="secondary" />
            <AppText variant="captionStrong" color="secondary" numberOfLines={1}>
              {distance}
            </AppText>
          </View>
          <View style={styles.meta}>
            <Icon name="tag-multiple-outline" size={15} color={request.pendingOfferCount > 0 ? 'primary' : 'accent'} />
            <AppText variant="captionStrong" color={request.pendingOfferCount > 0 ? 'primary' : 'accent'} numberOfLines={1}>
              {request.pendingOfferCount > 0 ? t('common:counts.offers', { count: request.pendingOfferCount }) : t('explore:preview.beFirst')}
            </AppText>
          </View>
        </View>
      </Pressable>

      <IconButton
        icon="close"
        size="sm"
        variant="soft"
        tone="neutral"
        accessibilityLabel={t('explore:preview.close')}
        onPress={onClose}
        style={styles.close}
      />

      <View style={styles.footer}>
        {request.myOffer ? (
          <View style={styles.myOffer}>
            <AppText variant="caption" color="muted">
              {t('common:request.yourOffer')}
            </AppText>
            <PriceText amount={request.myOffer.price} currency={request.myOffer.currency} variant="captionStrong" />
            <OfferStatusBadge status={request.myOffer.status} size="sm" withIcon={false} />
          </View>
        ) : (
          <View style={styles.myOffer} />
        )}
        <Button
          label={t('explore:preview.viewRequest')}
          size="sm"
          rightIcon="arrow-right"
          flipIconsInRTL
          onPress={onOpen}
          testID="explore-map-preview-open"
        />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.md,
    ...t.shadows.lg,
  },
  summary: {
    gap: t.spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  headerTexts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  closeSpace: {
    width: CLOSE_BUTTON_SIZE,
  },
  close: {
    position: 'absolute',
    top: t.spacing.lg + (HEADER_ICON_SIZE - CLOSE_BUTTON_SIZE) / 2,
    end: t.spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  shrink: {
    flexShrink: 1,
  },
  noShrink: {
    flexShrink: 0,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: t.spacing.md,
    rowGap: t.spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.spacing.md,
  },
  myOffer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    flexShrink: 1,
  },
}));
