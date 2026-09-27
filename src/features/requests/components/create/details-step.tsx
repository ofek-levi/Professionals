import { Controller, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { FormTextField, PhotoPicker, useTranslatedError } from '@/components/forms';
import { AppText, Card, Icon } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useCategory, useCategoryName } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';

import type { RequestFormControl } from './form-types';
import { StepIntro } from './step-intro';
import { descriptionPlaceholderKey, firstErrorMessage, formPhotosToPicked, pickedPhotosToForm } from './wizard-model';

const TIP_KEYS = ['what', 'size', 'access'] as const;

export interface DetailsStepProps {
  control: RequestFormControl;
  onChangeService: () => void;
}

/** Step 2 – describe the job, add photos and notes. */
export function DetailsStep({ control, onChangeService }: DetailsStepProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['requests', 'common']);
  const translateError = useTranslatedError();
  const categoryId = useWatch({ control, name: 'categoryId' });
  const category = useCategory(categoryId);
  const categoryName = useCategoryName(categoryId) || t('common:category.unknown');
  const placeholderKey = descriptionPlaceholderKey(category?.groupId);

  return (
    <View style={styles.container}>
      <StepIntro icon="text-box-edit-outline" title={t('requests:details.title')} subtitle={t('requests:details.subtitle')} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('requests:details.changeServiceA11y', { name: categoryName })}
        onPress={onChangeService}
        style={({ pressed }) => [styles.service, pressed ? styles.pressed : null]}
        testID="wizard-change-service"
      >
        <CategoryIcon categoryId={categoryId} size="sm" />
        <View style={styles.flex}>
          <AppText variant="label" color="muted">
            {t('requests:details.selectedService')}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {categoryName}
          </AppText>
        </View>
        <AppText variant="captionStrong" color="primary">
          {t('common:actions.change')}
        </AppText>
      </Pressable>

      <FormTextField
        control={control}
        name="description"
        label={t('requests:details.descriptionLabel', { category: categoryName })}
        placeholder={t(`requests:details.placeholders.${placeholderKey}`)}
        helperText={t('requests:details.descriptionHelper', { min: APP_CONFIG.descriptionMinLength })}
        required
        multiline
        minRows={5}
        maxLength={APP_CONFIG.descriptionMaxLength}
        showCounter
        testID="wizard-description"
      />

      <Card variant="flat" padding="md">
        <View style={styles.tipsHeader}>
          <Icon name="lightbulb-on-outline" size={18} color={theme.colors.tones.warning.fg} />
          <AppText variant="captionStrong">{t('requests:details.tips.title')}</AppText>
        </View>
        {TIP_KEYS.map((key) => (
          <View key={key} style={styles.tip}>
            <Icon name="check" size={14} color="success" />
            <AppText variant="caption" color="secondary" style={styles.flex}>
              {t(`requests:details.tips.${key}`)}
            </AppText>
          </View>
        ))}
      </Card>

      <Controller
        control={control}
        name="photos"
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <PhotoPicker
            label={t('requests:details.photosLabel')}
            helperText={t('requests:details.photosHelper')}
            optional
            value={formPhotosToPicked(value)}
            onChange={(picked) => onChange(pickedPhotosToForm(picked, value))}
            error={translateError(firstErrorMessage(error))}
            testID="wizard-photos"
          />
        )}
      />

      <FormTextField
        control={control}
        name="notes"
        label={t('requests:details.notesLabel')}
        placeholder={t('requests:details.notesPlaceholder')}
        helperText={t('requests:details.notesHelper')}
        optional
        multiline
        minRows={2}
        maxLength={APP_CONFIG.notesMaxLength}
        showCounter
        testID="wizard-notes"
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xl,
  },
  flex: {
    flex: 1,
  },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.md,
    borderRadius: t.radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    minHeight: 56,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginBottom: t.spacing.sm,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
  },
}));
