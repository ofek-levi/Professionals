/**
 * Where the job is: a small static map with a fuzzy circle around the approximate point (or the
 * exact pin once the professional was selected), distance and neighborhood.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppMap } from '@/components/map';
import { AppText, Card, Icon } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { ServiceLocation } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

/** Radius of the privacy circle drawn around an approximate location (km). */
const FUZZY_RADIUS_KM = 0.6;

export interface ApproximateLocationCardProps {
  location: ServiceLocation;
  distanceKm: number;
}

export function ApproximateLocationCard({ location, distanceKm }: ApproximateLocationCardProps) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const area = [location.neighborhood, location.city].filter(Boolean).join(', ');
  const approximate = location.isApproximate;
  const region = regionForRadius(location.coordinates, approximate ? FUZZY_RADIUS_KM * 2.2 : 0.8);

  return (
    <Card padding="none" style={styles.card} testID="pro-request-location">
      <AppMap
        style={styles.map}
        initialRegion={region}
        circles={approximate ? [{ id: 'fuzzy', center: location.coordinates, radiusKm: FUZZY_RADIUS_KM, tone: 'info' }] : []}
        markers={approximate ? [] : [{ id: 'job', coordinate: location.coordinates, icon: 'home-map-marker', tone: 'brand', selected: true }]}
        interactive={false}
        showZoomControls={false}
        accessibilityLabel={approximate ? t('professional:request.location.mapApproximate', { area }) : t('professional:request.location.mapExact')}
      />
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <Icon name={approximate ? 'map-marker-radius-outline' : 'map-marker-check-outline'} size={20} color="primary" />
          </View>
          <View style={styles.texts}>
            {approximate ? (
              <AppText variant="bodyStrong" numberOfLines={2}>
                {area || t('common:approximateLocation')}
              </AppText>
            ) : (
              <>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {location.addressLine}
                </AppText>
                <AppText variant="caption" color="secondary" numberOfLines={1}>
                  {area}
                </AppText>
              </>
            )}
            <AppText variant="captionStrong" color="primary">
              {approximate
                ? t('professional:request.location.approxDistance', { distance: format.distance(distanceKm) })
                : format.distance(distanceKm, { away: true })}
            </AppText>
          </View>
        </View>
        {approximate ? (
          <View style={styles.note}>
            <Icon name="shield-lock-outline" size={16} color="secondary" />
            <AppText variant="caption" color="secondary" style={styles.flex}>
              {t('professional:request.location.privacyNote')}
            </AppText>
          </View>
        ) : location.details ? (
          <View style={styles.note}>
            <Icon name="door" size={16} color="secondary" />
            <AppText variant="caption" color="secondary" style={styles.flex}>
              {location.details}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  map: {
    height: 160,
    borderRadius: 0,
  },
  body: {
    padding: t.spacing.lg,
    gap: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  flex: {
    flex: 1,
  },
}));
