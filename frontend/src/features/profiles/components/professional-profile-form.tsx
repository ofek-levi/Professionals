/**
 * Edit the signed-in professional's profile. The essentials are visible (photo, name, business
 * name, headline, bio, services, service area, weekly hours, phone and email); the optional rest
 * (website, business details, starting price, experience, languages, emergency calls) sits in one
 * collapsed "More details" section. Rendered by `/profile/edit`.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { Pressable, View, type LayoutChangeEvent, type ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormSection, FormTextField, PriceInput, useTranslatedError } from '@/components/forms';
import { AppText, Button, ErrorState, Icon, Screen, SkeletonCard, SwitchRow, useConfirm, useErrorToast, useToast } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useOwnProfessionalProfile, useUpdateProfessionalProfile } from '@/hooks';
import { useAppLanguage } from '@/i18n/hooks';
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
import { makeStyles } from '@/theme';
import type { OwnProfessionalProfile } from '@/types/domain';

import { AvailabilitySection } from './pro-form/availability-section';
import { AvatarField } from './pro-form/avatar-field';
import { LanguagesField } from './pro-form/languages-field';
import { NumberStepper } from './pro-form/number-stepper';
import { mapProfileServerFieldErrors, touchesMoreDetails } from './pro-form/pro-form-model';
import { ServiceAreaSection } from './pro-form/service-area-section';
import { ServicesField } from './pro-form/services-field';

type ProfessionalProfileFormOutput = z.output<typeof professionalProfileFormSchema>;

/** Top-level error paths, plus `availability.*` children (the emergency switch lives in "More details"). */
function errorPaths(errors: FieldErrors<ProfessionalProfileFormValues>): string[] {
  const paths: string[] = Object.keys(errors);
  if (errors.availability) paths.push(...Object.keys(errors.availability).map((key) => `availability.${key}`));
  return paths;
}

/** `area`: scrolled to the service area when it opens. */
type FormFocus = 'area';

export function ProfessionalProfileForm({ focus }: { focus?: FormFocus } = {}) {
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
  return <ProfessionalProfileFormContent key={query.data.id} profile={query.data} focus={focus} />;
}

function ProfessionalProfileFormContent({ profile, focus }: { profile: OwnProfessionalProfile; focus?: FormFocus }) {
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation(['professional', 'common']);
  const translateError = useTranslatedError();
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const update = useUpdateProfessionalProfile();
  const language = useAppLanguage();
  // "More details" holds only optional fields: a profile without languages starts with the UI
  // language, so the one required field in there is never an empty, hidden error.
  const [defaults] = useState(() => {
    const values = professionalProfileToFormValues(profile);
    return values.languages.length > 0 ? values : { ...values, languages: [language] };
  });
  const { control, handleSubmit, setError, formState } = useForm<ProfessionalProfileFormValues, unknown, ProfessionalProfileFormOutput>({
    resolver: zodResolver(professionalProfileFormSchema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const [saved, setSaved] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const focused = useRef(false);
  const onAreaLayout = (event: LayoutChangeEvent) => {
    if (focus !== 'area' || focused.current) return;
    focused.current = true;
    scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
  };
  const hasChanges = formState.isDirty;

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
        await update.mutateAsync(toUpdateProfessionalProfilePayload(values as ProfessionalProfileFormValues));
        toast.show({ title: t('professional:form.saved'), tone: 'success' });
        setSaved(true);
      } catch (error) {
        const fieldErrors = mapProfileServerFieldErrors(toApiError(error).fieldErrors);
        const entries = Object.entries(fieldErrors);
        entries.forEach(([field, message]) => setError(field as keyof ProfessionalProfileFormValues, { type: 'server', message }));
        if (touchesMoreDetails(Object.keys(fieldErrors))) setMoreOpen(true);
        showError(error, entries.length > 0 ? { title: t('professional:form.fixFields') } : undefined);
      }
    },
    (errors) => {
      // A hidden optional field is invalid: open "More details" so it can be fixed.
      if (touchesMoreDetails(errorPaths(errors))) setMoreOpen(true);
      toast.show({ title: t('professional:form.fixFields'), tone: 'warning' });
    },
  );

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      gap="xxl"
      footer={
        <Button
          label={t('common:actions.saveChanges')}
          fullWidth
          loading={update.isPending}
          disabled={!hasChanges && !update.isPending}
          onPress={() => void save()}
          testID="pro-profile-save"
        />
      }
      scrollRef={scrollRef}
      testID="pro-profile-form"
    >
      <AvatarField name={profile.displayName} value={profile.avatarUrl} />

      <FormSection title={t('professional:form.identity.title')} variant="plain">
        <FormTextField control={control} name="fullName" label={t('professional:form.identity.fullName')} required autoComplete="name" maxLength={PROFILE_LIMITS.nameMax} testID="pro-form-full-name" />
        <FormTextField
          control={control}
          name="displayName"
          label={t('professional:form.identity.displayName')}
          required
          maxLength={PROFILE_LIMITS.displayNameMax}
          testID="pro-form-display-name"
        />
        <FormTextField
          control={control}
          name="headline"
          label={t('professional:form.identity.headline')}
          placeholder={t('professional:form.identity.headlinePlaceholder')}
          maxLength={PROFILE_LIMITS.headlineMax}
          testID="pro-form-headline"
        />
        <FormTextField
          control={control}
          name="bio"
          label={t('professional:form.identity.bio')}
          placeholder={t('professional:form.identity.bioPlaceholder')}
          helperText={t('professional:form.identity.bioHelper', { min: PROFILE_LIMITS.bioMin })}
          multiline
          minRows={4}
          maxLength={PROFILE_LIMITS.bioMax}
          showCounter
          testID="pro-form-bio"
        />
      </FormSection>

      <FormSection title={t('professional:form.services.title')} variant="plain">
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
      </FormSection>

      <View onLayout={onAreaLayout} testID="pro-form-area-section">
        <ServiceAreaSection control={control} />
      </View>

      <AvailabilitySection control={control} />

      <FormSection title={t('professional:form.contact.title')} variant="plain">
        <FormTextField
          control={control}
          name="phone"
          label={t('professional:form.contact.phone')}
          required
          helperText={t('professional:form.contact.helper')}
          keyboardType="phone-pad"
          autoComplete="tel"
          testID="pro-form-phone"
        />
        <FormTextField
          control={control}
          name="email"
          label={t('professional:form.contact.email')}
          required
          // Customers see this address; the account keeps signing in with its own email.
          helperText={t('professional:form.contact.emailHelper')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="pro-form-email"
        />
      </FormSection>

      <View style={styles.more}>
        <Pressable
          accessibilityRole="button"
          aria-expanded={moreOpen}
          onPress={() => setMoreOpen((open) => !open)}
          style={({ pressed }) => [styles.moreHeader, pressed ? styles.pressed : null]}
          testID="pro-form-more"
        >
          <AppText variant="heading" style={styles.flex}>
            {t('professional:form.more.title')}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('common:optional')}
          </AppText>
          <Icon name={moreOpen ? 'chevron-up' : 'chevron-down'} size={22} color="muted" />
        </Pressable>

        {moreOpen ? (
          <View style={styles.moreBody} testID="pro-form-more-body">
            <FormTextField
              control={control}
              name="website"
              label={t('professional:form.contact.website')}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="example.co.il"
              testID="pro-form-website"
            />
            <FormTextField control={control} name="businessName" label={t('professional:form.business.businessName')} maxLength={PROFILE_LIMITS.businessNameMax} testID="pro-form-business-name" />
            <FormTextField
              control={control}
              name="licenseNumber"
              label={t('professional:form.business.license')}
              autoCapitalize="characters"
              maxLength={PROFILE_LIMITS.licenseNumberMax}
              testID="pro-form-license"
            />
            <Controller
              control={control}
              name="startingPrice"
              render={({ field, fieldState }) => (
                <PriceInput
                  ref={field.ref}
                  label={t('professional:form.more.startingPrice')}
                  value={parseAmountInput(field.value)}
                  onChange={(amount) => field.onChange(amount === null ? '' : String(amount))}
                  onBlur={field.onBlur}
                  currency={APP_CONFIG.defaultCurrency}
                  error={translateError(fieldState.error?.message)}
                  testID="pro-form-starting-price"
                />
              )}
            />
            <Controller
              control={control}
              name="yearsOfExperience"
              render={({ field, fieldState }) => (
                <NumberStepper
                  label={t('professional:form.more.years')}
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
            <View>
              <Controller
                control={control}
                name="isInsured"
                render={({ field }) => (
                  <SwitchRow title={t('professional:form.more.insured')} value={field.value} onValueChange={field.onChange} testID="pro-form-insured" />
                )}
              />
              <Controller
                control={control}
                name="availability.acceptsEmergencyCalls"
                render={({ field }) => (
                  <SwitchRow
                    title={t('professional:form.more.emergency')}
                    description={t('professional:form.more.emergencyDescription')}
                    value={field.value}
                    onValueChange={field.onChange}
                    testID="pro-form-emergency"
                  />
                )}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  more: {
    gap: t.spacing.lg,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 52,
    paddingHorizontal: t.spacing.lg,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  flex: {
    flex: 1,
  },
  moreBody: {
    gap: t.spacing.lg,
  },
}));
