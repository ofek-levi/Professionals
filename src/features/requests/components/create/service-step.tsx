import { Controller } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryPicker } from '@/components/categories';
import { useTranslatedError } from '@/components/forms';
import { AppText } from '@/components/ui';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import { makeStyles } from '@/theme';
import type { CategoryId } from '@/types/domain';

import type { RequestFormControl } from './form-types';
import { StepIntro } from './step-intro';

export interface ServiceStepProps {
  control: RequestFormControl;
  /** Called after the customer picks a service (the wizard moves on). */
  onPicked: () => void;
}

/** Step 1 – which service is needed (single category from the catalog, searchable). */
export function ServiceStep({ control, onPicked }: ServiceStepProps) {
  const styles = useStyles();
  const { t } = useTranslation('requests');
  const translateError = useTranslatedError();

  return (
    <View style={styles.container}>
      <StepIntro icon="toolbox-outline" title={t('service.title')} subtitle={t('service.subtitle')} />
      <Controller
        control={control}
        name="categoryId"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <View style={styles.picker}>
            {error ? (
              <AppText variant="captionStrong" color="danger" accessibilityRole="alert">
                {translateError(error.message)}
              </AppText>
            ) : null}
            <CategoryPicker
              mode="single"
              value={value && isSupportedCategoryId(value) ? value : null}
              onChange={(id: CategoryId) => {
                onChange(id);
                onPicked();
              }}
              testID="wizard-category-picker"
            />
          </View>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xl,
  },
  picker: {
    gap: t.spacing.md,
  },
}));
