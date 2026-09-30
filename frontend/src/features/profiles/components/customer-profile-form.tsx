/**
 * Edit the signed-in customer's profile: photo (saved at once, `use-avatar-actions.ts`), name, phone
 * and default service address (a row that opens the location picker in a sheet). Rendered by
 * `/profile/edit` for customers.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormSection, FormTextField, useTranslatedError } from '@/components/forms';
import { LocationPicker } from '@/components/location';
import {
  AppText,
  Avatar,
  Button,
  Card,
  ErrorState,
  Icon,
  Screen,
  Sheet,
  SkeletonCard,
  useConfirm,
  useErrorToast,
  useToast,
} from '@/components/ui';
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks';
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

import { useAvatarActions } from './use-avatar-actions';

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
  const update = useUpdateCustomerProfile();
  const avatar = useAvatarActions({
    pickFailed: t('profile:edit.photoFailed'),
    removeTitle: t('profile:edit.removePhotoTitle'),
    removeLabel: t('common:actions.remove'),
    updated: t('profile:edit.photoUpdated'),
    removed: t('profile:edit.photoRemoved'),
  });
  const avatarBusy = avatar.uploading || avatar.removing;
  const { control, handleSubmit, setError, formState } = useForm<CustomerProfileFormValues, unknown, CustomerProfileFormOutput>({
    resolver: zodResolver(customerProfileFormSchema),
    defaultValues: customerProfileToFormValues(user, profile),
    mode: 'onTouched',
  });
  const [saved, setSaved] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const hasChanges = formState.isDirty;
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

  const save = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(toUpdateCustomerProfilePayload(values));
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
      gap="xxl"
      footer={
        <Button
          label={t('common:actions.saveChanges')}
          size="lg"
          fullWidth
          loading={update.isPending}
          disabled={!hasChanges && !update.isPending}
          onPress={() => void save()}
          testID="profile-save"
        />
      }
      testID="customer-profile-form"
    >
      <View style={styles.avatarBlock}>
        <Avatar name={fullName} uri={user.avatarUrl} size="xl" />
        <View style={styles.avatarActions}>
          <Button
            label={user.avatarUrl ? t('profile:edit.changePhoto') : t('profile:edit.addPhoto')}
            variant="ghost"
            size="sm"
            loading={avatar.uploading}
            disabled={avatarBusy}
            onPress={() => void avatar.pick()}
            testID="profile-change-photo"
          />
          {user.avatarUrl ? (
            <Button
              label={t('profile:edit.removePhoto')}
              variant="ghost"
              size="sm"
              loading={avatar.removing}
              disabled={avatarBusy}
              onPress={() => void avatar.remove()}
              testID="profile-remove-photo"
            />
          ) : null}
        </View>
      </View>

      <FormSection title={t('profile:edit.personal')} variant="plain">
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
          testID="profile-phone"
        />
      </FormSection>

      <Controller
        control={control}
        name="defaultLocation"
        render={({ field: { value, onChange }, fieldState: { error } }) => {
          const location: ServiceLocation | null = value ? { ...value, isApproximate: false } : null;
          const errorText = translateError(nestedErrorMessage(error));
          const area = location ? [location.neighborhood, location.city].filter(Boolean).join(', ') : '';
          return (
            <FormSection title={t('profile:edit.address')} optional variant="plain">
              <Card padding="none" onPress={() => setAddressOpen(true)} style={styles.addressRow} testID="profile-address">
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" color={location ? 'default' : 'primary'} numberOfLines={2}>
                    {location ? location.addressLine || area : t('profile:edit.addAddress')}
                  </AppText>
                  {location && location.addressLine && area ? (
                    <AppText variant="caption" color="secondary" numberOfLines={1}>
                      {area}
                    </AppText>
                  ) : null}
                </View>
                {location ? (
                  <AppText variant="captionStrong" color="primary">
                    {t('common:actions.change')}
                  </AppText>
                ) : (
                  <Icon name="chevron-right" size={20} color="muted" flipInRTL />
                )}
              </Card>
              {errorText ? (
                <AppText variant="caption" color="danger">
                  {errorText}
                </AppText>
              ) : null}
              <Sheet
                visible={addressOpen}
                onClose={() => setAddressOpen(false)}
                title={t('profile:edit.address')}
                footer={
                  <View style={styles.sheetFooter}>
                    <Button label={t('common:actions.done')} size="lg" fullWidth onPress={() => setAddressOpen(false)} />
                    {value ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          onChange(null);
                          setAddressOpen(false);
                        }}
                        hitSlop={8}
                        style={styles.removeAddress}
                      >
                        <AppText variant="bodyStrong" color="danger">
                          {t('profile:edit.clearAddress')}
                        </AppText>
                      </Pressable>
                    ) : null}
                  </View>
                }
              >
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
                  error={errorText}
                  testID="profile-location"
                />
              </Sheet>
            </FormSection>
          );
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  avatarBlock: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingTop: t.spacing.sm,
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    gap: t.spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    minHeight: 64,
    paddingVertical: t.spacing.md,
  },
  sheetFooter: {
    gap: t.spacing.sm,
    alignItems: 'center',
  },
  removeAddress: {
    minHeight: 40,
    justifyContent: 'center',
  },
}));
