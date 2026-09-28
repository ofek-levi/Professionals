import { useController } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryPicker } from '@/components/categories';
import { FormTextField, useTranslatedError } from '@/components/forms';
import { Field } from '@/components/ui';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import { PROFILE_LIMITS } from '@/lib/validation';
import { makeStyles } from '@/theme';
import type { CategoryId } from '@/types/domain';

import type { SignUpStepProps } from './step-props';

/** Step 3 (professionals) – an optional business name and the services offered (1–10). */
export function ServicesStep({ control, anchor }: SignUpStepProps) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  const translateError = useTranslatedError();
  const categories = useController({ control, name: 'categoryIds' });
  const selected = categories.field.value.filter((id): id is CategoryId => isSupportedCategoryId(id));
  const label = t('signUp.services.servicesLabel');
  const error = translateError(categories.fieldState.error?.message);

  return (
    <>
      <View onLayout={anchor('businessName')}>
        <FormTextField
          control={control}
          name="businessName"
          label={t('fields.businessName')}
          optional
          helperText={t('signUp.services.businessNameHelper')}
          maxLength={PROFILE_LIMITS.businessNameMax}
          autoCapitalize="words"
          autoComplete="organization"
          textContentType="organizationName"
          returnKeyType="done"
          testID="sign-up-business-name"
        />
      </View>

      {/* One labelled group for screen readers ("Services, <error>"); the error sits under the
          label, above the long catalog list. */}
      <View onLayout={anchor('categoryIds')} role="group" aria-label={error ? `${label}, ${error}` : label}>
        <Field label={label} required error={error} errorPosition="top" style={styles.services}>
          <CategoryPicker
            mode="multiple"
            value={selected}
            onChange={(ids) => {
              categories.field.onChange(ids);
              categories.field.onBlur();
            }}
            maxSelected={PROFILE_LIMITS.maxCategories}
            testID="sign-up-services"
          />
        </Field>
      </View>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  services: {
    gap: t.spacing.md,
  },
}));
