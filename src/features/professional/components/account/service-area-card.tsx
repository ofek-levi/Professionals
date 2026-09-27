/** Static mini map of the service area with its label and radius. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppMap } from '@/components/map';
import { AppText, Button, Card, Icon } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { ServiceArea, ServiceLocation } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

export interface ServiceAreaCardProps {
  serviceArea: ServiceArea;
  baseLocation: ServiceLocation | null;
  onEdit: () => void;
}

export function ServiceAreaCard({ serviceArea, baseLocation, onEdit }: ServiceAreaCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  const format = useFormatters();
  const region = regionForRadius(serviceArea.center, serviceArea.radiusKm);
  return (
    <Card padding="none" style={styles.card} testID="pro-account-service-area">
      <AppMap
        key={`${serviceArea.center.latitude}|${serviceArea.center.longitude}|${serviceArea.radiusKm}`}
        style={styles.map}
        initialRegion={region}
        circles={[{ id: 'area', center: serviceArea.center, radiusKm: serviceArea.radiusKm, tone: 'brand' }]}
        markers={[{ id: 'base', coordinate: serviceArea.center, icon: 'home-variant', tone: 'brand' }]}
        interactive={false}
        showZoomControls={false}
        accessibilityLabel={t('account.serviceArea.mapLabel', { area: serviceArea.label, distance: format.distance(serviceArea.radiusKm) })}
      />
      <View style={styles.body}>
        <View style={styles.iconBox}>
          <Icon name="map-marker-radius" size={20} color="primary" />
        </View>
        <View style={styles.texts}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {serviceArea.label}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {baseLocation
              ? t('account.serviceArea.fromBase', { distance: format.distance(serviceArea.radiusKm), address: baseLocation.addressLine || baseLocation.city })
              : t('account.serviceArea.radius', { distance: format.distance(serviceArea.radiusKm) })}
          </AppText>
        </View>
        <Button label={t('account.serviceArea.edit')} size="sm" variant="secondary" onPress={onEdit} />
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  map: {
    height: 150,
    borderRadius: 0,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
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
}));
