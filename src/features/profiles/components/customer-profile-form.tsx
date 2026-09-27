/**
 * Edit the signed-in customer's profile: photo, name, phone and default service address.
 * Rendered by `/profile/edit` for customers.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormSection, FormTextField, pickImagesFromLibrary, useTranslatedError } from '@/components/forms';
import { LocationPicker } from '@/components/location';
import {
  AppText,
  Avatar,
  Button,
  ErrorState,
  IconButton,
  Screen,
  SkeletonCard,
  TextField,
  useConfirm,
  useErrorToast,
  useToast,
} from '@/components/ui';
import { useCustomerProfile, useUpdateCustomerProfile, useUploadImage } from '@/hooks';
import { routes } from '@/lib/routes';
import {
  customerProfileFormSchema,
  customerProfileToFormValues,
  toUpdateCustomerProfilePayload,
  type CustomerProfileFormValues,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import { makeStyles } from '@/theme';
import type { CustomerProfile, ServiceLocation, User } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

type CustomerProfileFormOutput = z.output<typeof customerProfileFormSchema>;
type FormField = keyof CustomerProfileFormValues;

const FORM_FIELDS: readonly FormField[] = ['firstName', 'lastName', 'phone', 'defaultLocation'];

function toFormField(path: string): FormField | null {
  const head = path.split('.')[0];
  return (FORM_FIELDS as readonly string[]).includes(head) ? (head as FormField) : null;
}

/** First message of a (possibly nested) field error, e.g. `defaultLocation.addressLine`. */
function nestedErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) return record.message;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'ref' || key === 'type') continue;
    const nested = nestedErrorMessage(value);
    if (nested) return nested;
  }
  return undefined;
}

export function CustomerProfileForm() {
  const profileQuery = useCustomerProfile();
  const data = profileQuery.data;

  if (!data) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="lg">
        {profileQuery.isError ? (
          <ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} retrying={profileQuery.isRefetching} />
        ) : (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </>
        )}
      </Screen>
    );
  }

  return <CustomerProfileFormContent key={data.user.id} user={data.user} profile={data.profile} />;
}

function CustomerProfileFormContent({ user, profile }: { user: User; profile: CustomerProfile }) {
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation(['profile', 'common']);
  const translateError = useTranslatedError();
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const upload = useUploadImage();
  const update = useUpdateCustomerProfile();
  const { control, handleSubmit, setError, formState } = useForm<CustomerProfileFormValues, unknown, CustomerProfileFormOutput>({
    resolver: zodResolver(customerProfileFormSchema),
    defaultValues: customerProfileToFormValues(user, profile),
    mode: 'onTouched',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [saved, setSaved] = useState(false);
  const avatarChanged = avatarUrl !== user.avatarUrl;
  const hasChanges = formState.isDirty || avatarChanged;
  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.displayName;

  usePreventRemove(hasChanges && !saved, ({ data }) => {
    void confirm({
      title: t('common:confirm.discardTitle'),
      message: t('common:confirm.discardMessage'),
      confirmLabel: t('common:actions.discard'),
      cancelLabel: t('profile:edit.keepEditing'),
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  useEffect(() => {
    if (!saved) return;
    // Opened directly (deep link / web refresh): there is nothing to go back to.
    if (router.canGoBack()) router.back();
    else router.replace(routes.customer.profile);
  }, [saved, router]);

  const pickAvatar = async () => {
    const result = await pickImagesFromLibrary(1);
    if (result.status === 'cancelled') return;
    if (result.status !== 'picked') {
      toast.show({ title: t('profile:edit.photoFailed'), tone: 'warning' });
      return;
    }
    const [photo] = result.photos;
    try {
      const uploaded = await upload.mutateAsync({
        ...photo,
        width: photo.width && photo.width > 0 ? photo.width : null,
        height: photo.height && photo.height > 0 ? photo.height : null,
      });
      setAvatarUrl(uploaded.url);
    } catch (error) {
      showError(error);
    }
  };

  const confirmRemoveAvatar = async () => {
    const confirmed = await confirm({
      title: t('profile:edit.removePhotoTitle'),
      confirmLabel: t('common:actions.remove'),
      destructive: true,
      icon: 'image-remove',
    });
    if (confirmed) setAvatarUrl(null);
  };

  const save = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        ...toUpdateCustomerProfilePayload(values),
        ...(avatarChanged ? { avatarUrl } : {}),
      });
      toast.show({ title: t('profile:edit.saved'), tone: 'success', icon: 'check-circle-outline' });
      setSaved(true);
    } catch (error) {
      const apiError = toApiError(error);
      let mapped = false;
      for (const [path, messages] of Object.entries(apiError.fieldErrors ?? {})) {
        const field = toFormField(path);
        if (field && messages[0]) {
          setError(field, { type: 'server', message: messages[0] });
          mapped = true;
        }
      }
      showError(error, mapped ? { title: t('profile:edit.fixFields') } : undefined);
    }
  });

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
          disabled={upload.isPending || (!hasChanges && !update.isPending)}
          onPress={() => void save()}
          testID="profile-save"
        />
      }
      testID="customer-profile-form"
    >
      <View style={styles.avatarBlock}>
        <View>
          <Avatar name={fullName} uri={avatarUrl} size="xl" />
          <IconButton
            icon="camera-outline"
            variant="filled"
            size="sm"
            accessibilityLabel={t('profile:edit.changePhoto')}
            onPress={() => void pickAvatar()}
            loading={upload.isPending}
            style={styles.cameraButton}
          />
        </View>
        <View style={styles.avatarActions}>
          <Button
            label={avatarUrl ? t('profile:edit.changePhoto') : t('profile:edit.addPhoto')}
            variant="secondary"
            size="sm"
            leftIcon="image-outline"
            loading={upload.isPending}
            onPress={() => void pickAvatar()}
            testID="profile-change-photo"
          />
          {avatarUrl ? (
            <Button label={t('profile:edit.removePhoto')} variant="ghost" size="sm" onPress={() => void confirmRemoveAvatar()} />
          ) : null}
        </View>
      </View>

      <FormSection title={t('profile:edit.personal')} icon="account-outline">
        <View style={styles.nameRow}>
          <FormTextField
            control={control}
            name="firstName"
            label={t('profile:edit.firstName')}
            required
            autoComplete="given-name"
            textContentType="givenName"
            containerStyle={styles.flex}
            testID="profile-first-name"
          />
          <FormTextField
            control={control}
            name="lastName"
            label={t('profile:edit.lastName')}
            required
            autoComplete="family-name"
            textContentType="familyName"
            containerStyle={styles.flex}
            testID="profile-last-name"
          />
        </View>
        <FormTextField
          control={control}
          name="phone"
          label={t('profile:edit.phone')}
          helperText={t('profile:edit.phoneHelper')}
          required
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          leftIcon="phone-outline"
          testID="profile-phone"
        />
        <TextField
          label={t('profile:edit.email')}
          value={user.email}
          disabled
          leftIcon="email-outline"
          helperText={t('profile:edit.emailHelper')}
        />
      </FormSection>

      <FormSection
        title={t('profile:edit.address')}
        description={t('profile:edit.addressDescription')}
        icon="home-map-marker"
        optional
      >
        <Controller
          control={control}
          name="defaultLocation"
          render={({ field: { value, onChange }, fieldState: { error } }) => {
            const location: ServiceLocation | null = value ? { ...value, isApproximate: false } : null;
            return (
              <View style={styles.location}>
                <LocationPicker
                  value={location}
                  onChange={(next) =>
                    onChange({
                      coordinates: next.coordinates,
                      addressLine: next.addressLine,
                      city: next.city,
                      neighborhood: next.neighborhood,
                      details: next.details,
                    })
                  }
                  initialRegion={location ? regionForRadius(location.coordinates, 1) : undefined}
                  error={translateError(nestedErrorMessage(error))}
                  testID="profile-location"
                />
                {value ? (
                  <Button
                    label={t('profile:edit.clearAddress')}
                    variant="ghost"
                    size="sm"
                    leftIcon="map-marker-remove-outline"
                    onPress={() => onChange(null)}
                  />
                ) : (
                  <AppText variant="caption" color="muted">
                    {t('profile:edit.noAddress')}
                  </AppText>
                )}
              </View>
            );
          }}
        />
      </FormSection>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
  },
  avatarBlock: {
    alignItems: 'center',
    gap: t.spacing.md,
    paddingTop: t.spacing.sm,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    borderWidth: 3,
    borderColor: t.colors.background,
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  location: {
    gap: t.spacing.sm,
    alignItems: 'stretch',
  },
}));
