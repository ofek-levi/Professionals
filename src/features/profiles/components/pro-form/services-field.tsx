/** Selected services as removable chips, edited in the shared category picker sheet. */
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip, CategoryPickerSheet } from '@/components/categories';
import { AppText, Button, Field } from '@/components/ui';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import { PROFILE_LIMITS } from '@/lib/validation';
import { makeStyles } from '@/theme';
import type { CategoryId } from '@/types/domain';

export interface ServicesFieldProps {
  value: readonly string[];
  onChange: (ids: CategoryId[]) => void;
  error?: string | null;
}

export function ServicesField({ value, onChange, error }: ServicesFieldProps) {
  const styles = useStyles();
  const { t } = useTranslation(['professional', 'common']);
  const [open, setOpen] = useState(false);
  const ids = value.filter((id): id is CategoryId => isSupportedCategoryId(id));

  return (
    <Field
      label={t('professional:form.services.label')}
      required
      helperText={t('professional:form.services.helper', { max: PROFILE_LIMITS.maxCategories })}
      error={error}
    >
      <View style={styles.chips}>
        {ids.length === 0 ? (
          <AppText variant="caption" color="muted">
            {t('professional:form.services.empty')}
          </AppText>
        ) : (
          ids.map((id) => (
            <CategoryChip key={id} categoryId={id} size="sm" selected onRemove={() => onChange(ids.filter((item) => item !== id))} />
          ))
        )}
      </View>
      <Button
        label={ids.length === 0 ? t('professional:form.services.add') : t('professional:form.services.edit')}
        variant="secondary"
        size="sm"
        leftIcon={ids.length === 0 ? 'plus' : 'pencil-outline'}
        onPress={() => setOpen(true)}
        style={styles.button}
        testID="pro-form-services"
      />
      <CategoryPickerSheet
        mode="multiple"
        visible={open}
        onClose={() => setOpen(false)}
        value={ids}
        onChange={onChange}
        maxSelected={PROFILE_LIMITS.maxCategories}
        title={t('professional:form.services.sheetTitle')}
      />
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  button: {
    marginTop: t.spacing.sm,
  },
}));
