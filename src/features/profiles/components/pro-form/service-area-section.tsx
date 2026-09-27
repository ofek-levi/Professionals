/**
 * Base location, service radius (presets + fine tuning within the configured bounds), area name and
 * a live map preview of the covered circle.
 */
import { useController, type Control } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FormSection, useTranslatedError } from '@/components/forms';
import { LocationPicker } from '@/components/location';
import { AppMap } from '@/components/map';
import { AppText, Chip, Field, TextField } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useFormatters } from '@/i18n/hooks';
import type { ProfessionalProfileFormValues } from '@/lib/validation';
import { makeStyles } from '@/theme';
import type { ServiceLocation } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

import { NumberStepper } from './number-stepper';
import { clampRadiusKm, firstNestedMessage, RADIUS_PRESETS_KM, RADIUS_STEP_KM } from './pro-form-model';

export function ServiceAreaSection({ control }: { control: Control<ProfessionalProfileFormValues> }) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const translateError = useTranslatedError();
  const base = useController({ control, name: 'baseLocation' });
  const area = useController({ control, name: 'serviceArea' });
  const labelField = useController({ control, name: 'serviceArea.label' });
  const radiusField = useController({ control, name: 'serviceArea.radiusKm' });
  const { center, radiusKm } = area.field.value;
  const baseValue: ServiceLocation | null = base.field.value ? { ...base.field.value, isApproximate: false } : null;

  const onBaseChange = (location: ServiceLocation) => {
    base.field.onChange({
      coordinates: { ...location.coordinates },
      addressLine: location.addressLine,
      city: location.city,
      neighborhood: location.neighborhood,
      details: location.details,
    });
    // The service area is centered on the base; its name follows the city unless customized.
    const previousCity = base.field.value?.city ?? '';
    const label = !area.field.value.label || area.field.value.label === previousCity ? location.city || area.field.value.label : area.field.value.label;
    area.field.onChange({ ...area.field.value, center: { ...location.coordinates }, label });
  };

  const setRadius = (value: number) => {
    radiusField.field.onChange(clampRadiusKm(value));
  };

  const baseError = firstNestedMessage(base.fieldState.error);

  return (
    <FormSection title={t('professional:form.area.title')} description={t('professional:form.area.description')} icon="map-marker-radius-outline">
      <LocationPicker
        label={t('professional:form.area.base')}
        value={baseValue}
        onChange={onBaseChange}
        initialRegion={regionForRadius(center, Math.min(radiusKm, 5))}
        showDetailsField={false}
        mapHeight={180}
        error={translateError(baseError)}
        testID="pro-form-base"
      />

      <Field label={t('professional:form.area.radius')} required error={translateError(radiusField.fieldState.error?.message)}>
        <View style={styles.chips}>
          {RADIUS_PRESETS_KM.map((km) => (
            <Chip key={km} size="sm" label={format.distance(km)} selected={radiusKm === km} onPress={() => setRadius(km)} />
          ))}
        </View>
      </Field>
      <NumberStepper
        label={t('professional:form.area.fineTune')}
        value={radiusKm}
        min={APP_CONFIG.minServiceRadiusKm}
        max={APP_CONFIG.maxServiceRadiusKm}
        step={RADIUS_STEP_KM}
        onChange={setRadius}
        formatValue={(value) => format.distance(value)}
        testID="pro-form-radius"
      />

      <View style={styles.preview}>
        <AppMap
          style={styles.map}
          region={regionForRadius(center, radiusKm)}
          initialRegion={regionForRadius(center, radiusKm)}
          circles={[{ id: 'area', center, radiusKm, tone: 'brand' }]}
          markers={[{ id: 'base', coordinate: center, icon: 'home-variant', tone: 'brand' }]}
          interactive={false}
          showZoomControls={false}
          accessibilityLabel={t('professional:form.area.previewLabel', { distance: format.distance(radiusKm) })}
        />
        <View style={styles.previewCaption}>
          <AppText variant="caption" color="secondary" style={styles.flex}>
            {t('professional:form.area.previewCaption', { distance: format.distance(radiusKm) })}
          </AppText>
        </View>
      </View>

      <TextField
        label={t('professional:form.area.label')}
        required
        value={labelField.field.value}
        onChangeText={labelField.field.onChange}
        onBlur={labelField.field.onBlur}
        helperText={t('professional:form.area.labelHelper')}
        error={translateError(labelField.fieldState.error?.message)}
        maxLength={80}
        leftIcon="map-outline"
        testID="pro-form-area-label"
      />
    </FormSection>
  );
}

const useStyles = makeStyles((t) => ({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  preview: {
    borderRadius: t.radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    overflow: 'hidden',
  },
  map: {
    height: 180,
    borderRadius: 0,
  },
  previewCaption: {
    flexDirection: 'row',
    padding: t.spacing.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  flex: {
    flex: 1,
  },
}));
