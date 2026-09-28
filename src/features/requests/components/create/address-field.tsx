import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LocationPicker } from '@/components/location';
import { AppText, Button, Card, Icon, Sheet } from '@/components/ui';
import type { RequestFormLocation } from '@/lib/validation';
import { makeStyles } from '@/theme';
import { regionForRadius, type MapRegion } from '@/utils/geo';

import { addressLabel, formLocationToService, serviceLocationToForm } from './request-form-model';

/** Map zoom around the chosen address (~ a few streets). */
const ADDRESS_RADIUS_KM = 1;

interface AddressFieldProps {
  value: RequestFormLocation | null;
  onChange: (location: RequestFormLocation) => void;
  /** Translated error of the location field (shown inside the sheet too). */
  error?: string;
  /** Where the map starts when no address is set yet. */
  initialRegion?: MapRegion;
}

/**
 * The service address as one row ("Florentin St 24, Tel Aviv-Yafo · Change"); tapping it opens
 * the location picker in a sheet.
 */
export function AddressField({ value, onChange, error, initialRegion }: AddressFieldProps) {
  const styles = useStyles();
  const { t } = useTranslation(['requests', 'common']);
  const [open, setOpen] = useState(false);
  const location = formLocationToService(value);
  const label = value ? addressLabel(value) : '';

  return (
    <View>
      <Card
        padding="none"
        onPress={() => setOpen(true)}
        accessibilityLabel={value ? t('requests:form.changeAddressA11y', { address: label }) : t('requests:form.addAddress')}
        style={styles.row}
        testID="request-form-address"
      >
        <AppText variant="bodyStrong" color={value ? 'default' : 'primary'} numberOfLines={2} style={styles.flex}>
          {value ? label : t('requests:form.addAddress')}
        </AppText>
        {/* One affordance: "Change" once set, a chevron while empty. */}
        {value ? (
          <AppText variant="captionStrong" color="primary">
            {t('common:actions.change')}
          </AppText>
        ) : (
          <Icon name="chevron-right" size={20} color="muted" flipInRTL />
        )}
      </Card>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('requests:form.where')}
        subtitle={t('requests:form.addressSheetSubtitle')}
        footer={<Button label={t('common:actions.done')} fullWidth onPress={() => setOpen(false)} testID="request-address-done" />}
        testID="request-address-sheet"
      >
        <LocationPicker
          value={location}
          onChange={(next) => onChange(serviceLocationToForm(next))}
          initialRegion={location ? regionForRadius(location.coordinates, ADDRESS_RADIUS_KM) : initialRegion}
          error={error}
          mapHeight={200}
          testID="request-location"
        />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    minHeight: 60,
  },
  flex: {
    flex: 1,
  },
}));
