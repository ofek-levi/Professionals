import { Controller } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTranslatedError } from '@/components/forms';
import { LocationPicker } from '@/components/location';
import { InlineAlert } from '@/components/ui';
import { makeStyles } from '@/theme';
import type { MapRegion } from '@/utils/geo';

import type { RequestFormControl } from './form-types';
import { StepIntro } from './step-intro';
import { firstErrorMessage, formLocationToService, serviceLocationToForm } from './wizard-model';

export interface LocationStepProps {
  control: RequestFormControl;
  initialRegion?: MapRegion;
}

/** Step 3 – where the service is needed. */
export function LocationStep({ control, initialRegion }: LocationStepProps) {
  const styles = useStyles();
  const { t } = useTranslation('requests');
  const translateError = useTranslatedError();

  return (
    <View style={styles.container}>
      <StepIntro icon="map-marker-radius-outline" title={t('location.title')} subtitle={t('location.subtitle')} />
      <Controller
        control={control}
        name="location"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <LocationPicker
            value={formLocationToService(value)}
            onChange={(location) => onChange(serviceLocationToForm(location))}
            initialRegion={initialRegion}
            error={translateError(firstErrorMessage(error))}
            label={t('location.label')}
            required
            mapHeight={240}
            testID="wizard-location"
          />
        )}
      />
      <InlineAlert tone="info" icon="shield-lock-outline" title={t('location.privacyTitle')} message={t('location.privacy')} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xl,
  },
}));
