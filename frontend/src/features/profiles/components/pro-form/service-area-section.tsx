/**
 * Service area: the base address (a row that opens the location picker in a sheet), the travel
 * radius and the area name shown to customers.
 */
import { useState } from 'react';
import { useController, type Control } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FormSection, useTranslatedError } from '@/components/forms';
import { LocationPicker } from '@/components/location';
import { AppText, Button, Card, Chip, Field, Sheet, TextField } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import type { ProfessionalProfileFormValues } from '@/lib/validation';
import { makeStyles } from '@/theme';
import type { ServiceLocation } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

import { clampRadiusKm, firstNestedMessage, radiusOptions } from './pro-form-model';

export function ServiceAreaSection({ control }: { control: Control<ProfessionalProfileFormValues> }) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const translateError = useTranslatedError();
  const base = useController({ control, name: 'baseLocation' });
  const area = useController({ control, name: 'serviceArea' });
  const labelField = useController({ control, name: 'serviceArea.label' });
  const radiusField = useController({ control, name: 'serviceArea.radiusKm' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const { center, radiusKm } = area.field.value;
  const baseValue: ServiceLocation | null = base.field.value ? { ...base.field.value, isApproximate: false } : null;
  const baseError = translateError(firstNestedMessage(base.fieldState.error));

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

  const baseSummary = baseValue ? [baseValue.addressLine, baseValue.city].filter(Boolean).join(', ') : t('professional:form.area.baseEmpty');

  return (
    <FormSection title={t('professional:form.area.title')} variant="plain">
      <Field label={t('professional:form.area.base')} error={baseError}>
        <Card
          padding="none"
          onPress={() => setPickerOpen(true)}
          accessibilityLabel={`${t('professional:form.area.base')}, ${baseSummary}`}
          style={styles.row}
          testID="pro-form-base"
        >
          <AppText variant="body" color={baseValue ? 'default' : 'muted'} numberOfLines={2} style={styles.flex}>
            {baseSummary}
          </AppText>
          <AppText variant="captionStrong" color="primary">
            {t('common:actions.change')}
          </AppText>
        </Card>
      </Field>

      <Field label={t('professional:form.area.radius')} required error={translateError(radiusField.fieldState.error?.message)}>
        <View style={styles.chips}>
          {radiusOptions(radiusKm).map((km) => (
            <Chip
              key={km}
              size="sm"
              label={format.distance(km)}
              selected={radiusKm === km}
              onPress={() => radiusField.field.onChange(clampRadiusKm(km))}
              testID={`pro-form-radius-${km}`}
            />
          ))}
        </View>
      </Field>

      <TextField
        label={t('professional:form.area.label')}
        required
        value={labelField.field.value}
        onChangeText={labelField.field.onChange}
        onBlur={labelField.field.onBlur}
        helperText={t('professional:form.area.labelHelper')}
        error={translateError(labelField.fieldState.error?.message)}
        maxLength={80}
        testID="pro-form-area-label"
      />

      <Sheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('professional:form.area.base')}
        footer={<Button label={t('common:actions.done')} fullWidth onPress={() => setPickerOpen(false)} />}
      >
        <LocationPicker
          value={baseValue}
          onChange={onBaseChange}
          initialRegion={regionForRadius(center, Math.min(radiusKm, 5))}
          showDetailsField={false}
          mapHeight={200}
          error={baseError}
        />
      </Sheet>
    </FormSection>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 52,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  flex: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
}));
