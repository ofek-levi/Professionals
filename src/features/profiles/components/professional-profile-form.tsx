/**
 * Edit the signed-in professional's profile: photo, identity, services, experience, service area,
 * weekly hours, contact, business details and starting price. Rendered by `/profile/edit`.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormSection, FormTextField, PriceInput, useTranslatedError } from '@/components/forms';
import { Button, ErrorState, Screen, SkeletonCard, useConfirm, useErrorText, useToast } from '@/components/ui';
import { ToggleRow } from '@/features/professional/components/shared/toggle-row';
import { APP_CONFIG } from '@/constants/app-config';
import { useOwnProfessionalProfile, useUpdateProfessionalProfile } from '@/hooks';
import { routes } from '@/lib/routes';
import {
  parseAmountInput,
  PROFILE_LIMITS,
  professionalProfileFormSchema,
  professionalProfileToFormValues,
  toUpdateProfessionalProfilePayload,
  type ProfessionalProfileFormValues,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import type { OwnProfessionalProfile } from '@/types/domain';

import { AvailabilitySection } from './pro-form/availability-section';
import { AvatarField } from './pro-form/avatar-field';
import { LanguagesField } from './pro-form/languages-field';
import { NumberStepper } from './pro-form/number-stepper';
import { mapProfileServerFieldErrors } from './pro-form/pro-form-model';
import { ServiceAreaSection } from './pro-form/service-area-section';
import { ServicesField } from './pro-form/services-field';

type ProfessionalProfileFormOutput = z.output<typeof professionalProfileFormSchema>;

export function ProfessionalProfileForm() {
  const { t } = useTranslation(['professional', 'common']);
  const query = useOwnProfessionalProfile();
  if (!query.data) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="lg" testID="pro-profile-form-loading">
        {query.isError ? (
          <ErrorState
            error={query.error}
            description={t('professional:form.loadError')}
            onRetry={() => void query.refetch()}
            retrying={query.isRefetching}
          />
        ) : (
          <>
            <SkeletonCard />
            <SkeletonCard lines={3} withAvatar={false} />
            <SkeletonCard lines={3} withAvatar={false} />
          </>
        )}
      </Screen>
    );
  }
  return <ProfessionalProfileFormContent key={query.data.id} profile={query.data} />;
}

function ProfessionalProfileFormContent({ profile }: { profile: OwnProfessionalProfile }) {
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation(['professional', 'common']);
  const translateError = useTranslatedError();
  const confirm = useConfirm();
  const toast = useToast();
  const errorText = useErrorText();
  const update = useUpdateProfessionalProfile();
  const [defaults] = useState(() => professionalProfileToFormValues(profile));
  const { control, handleSubmit, setError, formState } = useForm<ProfessionalProfileFormValues, unknown, ProfessionalProfileFormOutput>({
    resolver: zodResolver(professionalProfileFormSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const [saved, setSaved] = useState(false);
  const avatarChanged = avatarUrl !== profile.avatarUrl;
  const hasChanges = formState.isDirty || avatarChanged;

  usePreventRemove(hasChanges && !saved, ({ data }) => {
    void confirm({
      title: t('common:confirm.discardTitle'),
      message: t('common:confirm.discardMessage'),
      confirmLabel: t('common:actions.discard'),
      cancelLabel: t('professional:form.keepEditing'),
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  useEffect(() => {
    if (!saved) return;
    // Opened directly (deep link / web refresh): there is nothing to go back to.
    if (router.canGoBack()) router.back();
    else router.replace(routes.professional.profile);
  }, [saved, router]);

  const save = handleSubmit(
    async (values) => {
      try {
        await update.mutateAsync({
          ...toUpdateProfessionalProfilePayload(values as ProfessionalProfileFormValues),
          ...(avatarChanged ? { avatarUrl } : {}),
        });
        toast.show({ title: t('professional:form.saved'), message: t('professional:form.savedMessage'), tone: 'success', icon: 'check-circle-outline' });
        setSaved(true);
      } catch (error) {
        const fieldErrors = mapProfileServerFieldErrors(toApiError(error).fieldErrors);
        const entries = Object.entries(fieldErrors);
        entries.forEach(([field, message]) => setError(field as keyof ProfessionalProfileFormValues, { type: 'server', message }));
        toast.show({ ...errorText(error), title: entries.length > 0 ? t('professional:form.fixFields') : errorText(error).title, tone: 'danger' });
      }
    },
    () => toast.show({ title: t('professional:form.fixFields'), message: t('professional:form.fixFieldsMessage'), tone: 'warning' }),
  );

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      gap="xl"
      footer={
        <Button
          label={t('common:actions.saveChanges')}
          leftIcon="content-save-outline"
          size="lg"
          fullWidth
          loading={update.isPending}
          disabled={!hasChanges && !update.isPending}
          onPress={() => void save()}
          testID="pro-profile-save"
        />
      }
      testID="pro-profile-form"
    >
      <AvatarField name={profile.displayName} value={avatarUrl} verified={profile.isVerified} onChange={setAvatarUrl} />

      <FormSection title={t('professional:form.identity.title')} description={t('professional:form.identity.description')} icon="account-outline">
        <FormTextField control={control} name="fullName" label={t('professional:form.identity.fullName')} required autoComplete="name" maxLength={PROFILE_LIMITS.nameMax} testID="pro-form-full-name" />
        <FormTextField
          control={control}
          name="displayName"
          label={t('professional:form.identity.displayName')}
          helperText={t('professional:form.identity.displayNameHelper')}
          required
          maxLength={PROFILE_LIMITS.displayNameMax}
          testID="pro-form-display-name"
        />
        <FormTextField
          control={control}
          name="headline"
          label={t('professional:form.identity.headline')}
          placeholder={t('professional:form.identity.headlinePlaceholder')}
          required
          maxLength={PROFILE_LIMITS.headlineMax}
          showCounter
          testID="pro-form-headline"
        />
        <FormTextField
          control={control}
          name="bio"
          label={t('professional:form.identity.bio')}
          placeholder={t('professional:form.identity.bioPlaceholder')}
          helperText={t('professional:form.identity.bioHelper', { min: PROFILE_LIMITS.bioMin })}
          required
          multiline
          minRows={5}
          maxLength={PROFILE_LIMITS.bioMax}
          showCounter
          testID="pro-form-bio"
        />
      </FormSection>

      <FormSection title={t('professional:form.services.title')} description={t('professional:form.services.description')} icon="toolbox-outline">
        <Controller
          control={control}
          name="categoryIds"
          render={({ field, fieldState }) => (
            <ServicesField
              value={field.value}
              onChange={(ids) => {
                field.onChange(ids);
                field.onBlur();
              }}
              error={translateError(fieldState.error?.message)}
            />
          )}
        />
        <Controller
          control={control}
          name="yearsOfExperience"
          render={({ field, fieldState }) => (
            <NumberStepper
              label={t('professional:form.services.years')}
              value={field.value}
              onChange={field.onChange}
              min={0}
              max={PROFILE_LIMITS.maxYearsOfExperience}
              formatValue={(value) => t('common:units.years', { count: value })}
              error={translateError(fieldState.error?.message)}
              testID="pro-form-years"
            />
          )}
        />
      </FormSection>

      <ServiceAreaSection control={control} />

      <AvailabilitySection control={control} />

      <FormSection title={t('professional:form.contact.title')} description={t('professional:form.contact.description')} icon="card-account-phone-outline">
        <FormTextField control={control} name="phone" label={t('professional:form.contact.phone')} required keyboardType="phone-pad" autoComplete="tel" leftIcon="phone-outline" testID="pro-form-phone" />
        <FormTextField
          control={control}
          name="email"
          label={t('professional:form.contact.email')}
          required
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          leftIcon="email-outline"
          testID="pro-form-email"
        />
        <FormTextField
          control={control}
          name="website"
          label={t('professional:form.contact.website')}
          optional
          keyboardType="url"
          autoCapitalize="none"
          placeholder="example.co.il"
          leftIcon="web"
          testID="pro-form-website"
        />
      </FormSection>

      <FormSection title={t('professional:form.business.title')} description={t('professional:form.business.description')} icon="domain">
        <FormTextField control={control} name="businessName" label={t('professional:form.business.businessName')} optional maxLength={PROFILE_LIMITS.businessNameMax} testID="pro-form-business-name" />
        <FormTextField
          control={control}
          name="licenseNumber"
          label={t('professional:form.business.license')}
          helperText={t('professional:form.business.licenseHelper')}
          optional
          autoCapitalize="characters"
          maxLength={PROFILE_LIMITS.licenseNumberMax}
          testID="pro-form-license"
        />
        <Controller
          control={control}
          name="isInsured"
          render={({ field }) => (
            <ToggleRow
              icon="shield-check-outline"
              iconTone="accent"
              title={t('professional:form.business.insured')}
              description={t('professional:form.business.insuredDescription')}
              value={field.value}
              onValueChange={field.onChange}
              testID="pro-form-insured"
            />
          )}
        />
        <Controller
          control={control}
          name="languages"
          render={({ field, fieldState }) => (
            <LanguagesField
              value={field.value}
              onChange={(languages) => {
                field.onChange(languages);
                field.onBlur();
              }}
              error={translateError(fieldState.error?.message)}
            />
          )}
        />
      </FormSection>

      <FormSection title={t('professional:form.pricing.title')} description={t('professional:form.pricing.description')} icon="cash" optional>
        <Controller
          control={control}
          name="startingPrice"
          render={({ field, fieldState }) => (
            <PriceInput
              ref={field.ref}
              label={t('professional:form.pricing.startingPrice')}
              value={parseAmountInput(field.value)}
              onChange={(amount) => field.onChange(amount === null ? '' : String(amount))}
              onBlur={field.onBlur}
              currency={APP_CONFIG.defaultCurrency}
              helperText={t('professional:form.pricing.helper')}
              error={translateError(fieldState.error?.message)}
              testID="pro-form-starting-price"
            />
          )}
        />
      </FormSection>
    </Screen>
  );
}
