/**
 * `/requests/new?categoryId=&draftId=` – posting a request on ONE screen: service, a description,
 * urgency (Normal preselected), the address (the customer's default one) and optional photos,
 * then a sticky "Post request". A draft (`draftId`) is prefilled and can be posted or deleted.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FormTextField, useTranslatedError, useUploadErrorToast } from '@/components/forms';
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  SkeletonCard,
  useConfirm,
  useErrorToast,
  useToast,
} from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import type { RequestStatus } from '@/constants/request-statuses';
import { useSession } from '@/features/auth/session-provider';
import { useCustomerProfile, useDeleteDraftRequest, useRequest, useRouteParam, useUpdateCustomerProfile } from '@/hooks';
import { useCategory } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import {
  createEmptyRequestFormValues,
  requestFormSchema,
  requestToFormValues,
  vm,
  type RequestFormLocation,
  type RequestFormValues,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import { makeStyles, useTheme } from '@/theme';
import type { CategoryId, CustomerRequestView } from '@/types/domain';
import { regionForRadius, type MapRegion } from '@/utils/geo';

import { AddressField } from '../components/create/address-field';
import { FormBlock } from '../components/create/form-block';
import type { RequestFormOutput } from '../components/create/form-types';
import { PhotosField } from '../components/create/photos-field';
import {
  apiFieldToFormField,
  descriptionPlaceholderKey,
  firstErrorMessage,
  firstFormField,
  keepPreferredDate,
  postedRequestHref,
  withDefaultUrgency,
  type RequestFormField,
} from '../components/create/request-form-model';
import { ServiceField } from '../components/create/service-field';
import { UrgencyOptions } from '../components/create/urgency-options';
import { useSubmitRequest } from '../components/create/use-submit-request';

/** Map zoom around the customer's default address. */
const DEFAULT_ADDRESS_RADIUS_KM = 2;

export default function CreateRequestScreen() {
  const { t } = useTranslation(['requests', 'common']);
  const router = useRouter();
  const { role } = useSession();
  const categoryParam = useRouteParam('categoryId');
  const draftId = useRouteParam('draftId');
  const profileQuery = useCustomerProfile();
  const draftQuery = useRequest(role === 'customer' ? draftId : null);

  const draftData = draftQuery.data;
  const draft = draftData?.viewerRole === 'customer' ? draftData.request : undefined;
  const profileReady = profileQuery.data !== undefined || profileQuery.isError;

  // The "already posted" guard looks at the draft as first loaded: posting re-seeds the cached
  // request as `open`, and reacting to that would replace the form before it navigates away.
  const [loadedStatus, setLoadedStatus] = useState<{ id: string; status: RequestStatus } | null>(null);
  if (draft && loadedStatus?.id !== draft.id) setLoadedStatus({ id: draft.id, status: draft.status });
  const initialStatus = draft ? (loadedStatus?.id === draft.id ? loadedStatus.status : draft.status) : null;

  if (role !== 'customer') {
    // Only customers post requests (e.g. a professional opening a deep link).
    return (
      <FormShell>
        <EmptyState
          title={t('requests:customersOnly.title')}
          description={t('requests:customersOnly.description')}
          actionLabel={role ? t('requests:customersOnly.action') : undefined}
          onAction={role ? () => router.replace(routes.homeFor(role)) : undefined}
        />
      </FormShell>
    );
  }

  if (draftId) {
    if (draftQuery.isError) {
      return (
        <FormShell>
          <ErrorState error={draftQuery.error} onRetry={() => void draftQuery.refetch()} retrying={draftQuery.isRefetching} />
        </FormShell>
      );
    }
    if (draft && initialStatus !== 'draft') {
      return (
        <FormShell>
          <EmptyState
            title={t('requests:alreadyPublished.title')}
            description={t('requests:alreadyPublished.description')}
            actionLabel={t('requests:alreadyPublished.action')}
            onAction={() => router.dismissTo(routes.request(draft.id))}
          />
        </FormShell>
      );
    }
  }

  if ((draftId && !draft) || !profileReady) {
    return (
      <FormShell>
        <FormSkeleton />
      </FormShell>
    );
  }

  const defaultLocation = profileQuery.data?.profile.defaultLocation ?? null;
  const location: RequestFormLocation | null = defaultLocation
    ? {
        coordinates: { ...defaultLocation.coordinates },
        addressLine: defaultLocation.addressLine,
        city: defaultLocation.city,
        neighborhood: defaultLocation.neighborhood,
        details: defaultLocation.details,
      }
    : null;
  const categoryId = categoryParam && isSupportedCategoryId(categoryParam) ? categoryParam : null;
  const defaultValues = withDefaultUrgency(draft ? requestToFormValues(draft) : createEmptyRequestFormValues({ categoryId, location }));
  const initialRegion = defaultLocation ? regionForRadius(defaultLocation.coordinates, DEFAULT_ADDRESS_RADIUS_KM) : undefined;

  return (
    <RequestForm
      key={draft?.id ?? 'new'}
      draft={draft ?? null}
      defaultValues={defaultValues}
      initialRegion={initialRegion}
      // The first post of a customer without an address makes its address the default.
      saveAddressAsDefault={profileQuery.data !== undefined && defaultLocation === null}
    />
  );
}

function FormShell({ children }: { children: ReactNode }) {
  return <Screen edges={['left', 'right', 'bottom']}>{children}</Screen>;
}

function FormSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton}>
      <Skeleton width="30%" height={18} />
      <SkeletonCard lines={1} />
      <Skeleton width="45%" height={18} />
      <Skeleton height={120} radius={14} />
      <Skeleton width="35%" height={18} />
      <Skeleton height={58} radius={12} />
    </View>
  );
}

interface RequestFormProps {
  draft: CustomerRequestView | null;
  defaultValues: RequestFormValues;
  initialRegion?: MapRegion;
  /** Save the posted request's address as the customer's default one (they have none yet). */
  saveAddressAsDefault: boolean;
}

/** Where the form goes once it is done (the leave guard is lifted first). */
type Completion = { kind: 'posted'; requestId: string } | { kind: 'deleted' };

function RequestForm({ draft, defaultValues, initialRegion, saveAddressAsDefault }: RequestFormProps) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation(['requests', 'customer', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const showUploadError = useUploadErrorToast({ photosOptional: true });
  const translateError = useTranslatedError();
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<RequestFormField, number>>>({});
  const submitRequest = useSubmitRequest(draft);
  const deleteDraft = useDeleteDraftRequest();
  const updateProfile = useUpdateCustomerProfile();

  const form = useForm<RequestFormValues, unknown, RequestFormOutput>({
    resolver: zodResolver(requestFormSchema),
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const { control, handleSubmit, getValues, setValue, setError } = form;
  const { isDirty, errors } = form.formState;
  const categoryId = useWatch({ control, name: 'categoryId' });
  const category = useCategory(categoryId);

  const [busy, setBusy] = useState<'post' | 'delete' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);

  // Leaving with unsaved input asks first (header back, gestures, hardware back).
  usePreventRemove((isDirty || busy !== null) && !completion, ({ data }) => {
    void confirm({
      title: t('common:confirm.discardTitle'),
      message: draft ? t('requests:leave.draftMessage') : t('requests:leave.message'),
      confirmLabel: t('common:actions.discard'),
      cancelLabel: t('requests:leave.keepEditing'),
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  // Navigate only after the guard above was lifted. A posted draft returns to its request page
  // when that is on the stack (never a second copy of it); a new request replaces the form.
  const editingDraft = draft !== null;
  useEffect(() => {
    if (!completion) return;
    if (completion.kind === 'deleted') {
      router.dismissAll();
      router.navigate(routes.customer.requests);
    } else if (editingDraft) {
      router.dismissTo(routes.request(completion.requestId));
    } else {
      router.replace(postedRequestHref(completion.requestId));
    }
  }, [completion, editingDraft, router]);

  const rememberPosition = (field: RequestFormField) => (y: number) => {
    positions.current[field] = y;
  };

  const scrollToField = (field: RequestFormField) => {
    const y = positions.current[field];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - theme.spacing.lg), animated: true });
  };

  const showInvalid = (fields: readonly string[]) => {
    const first = firstFormField(fields);
    if (first) scrollToField(first);
    else toast.show({ title: t('requests:submit.fixFields'), tone: 'warning' });
  };

  const applyServerErrors = (error: unknown) => {
    const apiError = toApiError(error);
    const fields: RequestFormField[] = [];
    for (const [path, messages] of Object.entries(apiError.fieldErrors ?? {})) {
      const field = apiFieldToFormField(path);
      if (field && messages[0]) {
        setError(field, { type: 'server', message: messages[0] });
        fields.push(field);
      }
    }
    if (apiError.code === 'UNSUPPORTED_CATEGORY' && !fields.includes('categoryId')) {
      setError('categoryId', { type: 'server', message: vm('category.unsupported') });
      fields.push('categoryId');
    }
    if (fields.length > 0) showInvalid(fields);
    else showError(error);
  };

  const post = async (values: RequestFormOutput) => {
    setBusy('post');
    // The new photos go with the request in one multipart post (a draft's stored ones are kept by id).
    const outcome = await submitRequest(
      { ...values, photos: getValues('photos') },
      { onUploading: setUploading, onPhotosSaved: (photos) => setValue('photos', photos) },
    );
    setBusy(null);
    if (outcome.ok) {
      if (saveAddressAsDefault) updateProfile.mutate({ defaultLocation: outcome.request.location });
      // A new request lands on its page with the "posted" banner; a draft returns to its page as it
      // was (no banner), so only it gets the toast.
      if (draft) toast.show({ title: t('requests:submit.posted'), tone: 'success' });
      setCompletion({ kind: 'posted', requestId: outcome.request.id });
    } else if (outcome.photoFailure) {
      // Explained by the photo toast (the photo, the limits or the photo service); the form scrolls
      // to the photos, which can be changed or removed before posting again.
      showUploadError(outcome.error);
      scrollToField('photos');
    } else {
      applyServerErrors(outcome.error);
    }
  };

  const submit = () => {
    // A draft's preferred date (not editable here) must not block posting once it no longer fits.
    const preferredDate = getValues('preferredDate');
    const kept = keepPreferredDate(preferredDate, getValues('urgency'), new Date());
    if (kept !== preferredDate) setValue('preferredDate', kept);
    void handleSubmit(post, (invalid: FieldErrors<RequestFormValues>) => showInvalid(Object.keys(invalid)))();
  };

  const removeDraft = async () => {
    if (!draft) return;
    const confirmed = await confirm({
      title: t('customer:details.draft.deleteConfirmTitle'),
      message: t('customer:details.draft.deleteConfirmMessage'),
      confirmLabel: t('common:actions.delete'),
      destructive: true,
    });
    if (!confirmed) return;
    setBusy('delete');
    try {
      await deleteDraft.mutateAsync(draft.id);
      toast.show({ title: t('customer:details.draft.deleted'), tone: 'neutral' });
      setCompletion({ kind: 'deleted' });
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  const title = draft ? t('requests:titleDraft') : t('common:screens.newRequest');

  const footer = (
    <View style={styles.footer}>
      {uploading ? (
        <AppText variant="caption" color="secondary" align="center" accessibilityLiveRegion="polite">
          {t('requests:submit.uploading')}
        </AppText>
      ) : null}
      <Button
        label={t('requests:submit.post')}
        fullWidth
        loading={busy === 'post'}
        disabled={busy !== null}
        onPress={submit}
        testID="request-form-post"
      />
    </View>
  );

  return (
    <Screen edges={['left', 'right', 'bottom']} scrollRef={scrollRef} footer={footer} testID="create-request-form">
      <Stack.Screen options={{ title }} />
      <View style={styles.body}>
        <Controller
          control={control}
          name="categoryId"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <FormBlock
              title={t('requests:form.service')}
              error={translateError(error?.message)}
              onLayout={(event) => rememberPosition('categoryId')(event.nativeEvent.layout.y)}
            >
              <ServiceField value={value && isSupportedCategoryId(value) ? value : null} onChange={(id: CategoryId) => onChange(id)} />
            </FormBlock>
          )}
        />

        <FormBlock
          title={t('requests:form.description')}
          onLayout={(event) => rememberPosition('description')(event.nativeEvent.layout.y)}
        >
          <FormTextField
            control={control}
            name="description"
            placeholder={t(`requests:form.placeholders.${descriptionPlaceholderKey(category?.groupId)}`)}
            accessibilityLabel={t('requests:form.description')}
            multiline
            minRows={4}
            maxLength={APP_CONFIG.descriptionMaxLength}
            testID="request-form-description"
          />
        </FormBlock>

        <Controller
          control={control}
          name="urgency"
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <FormBlock
              title={t('requests:form.urgency')}
              error={translateError(error?.message)}
              onLayout={(event) => rememberPosition('urgency')(event.nativeEvent.layout.y)}
            >
              <UrgencyOptions value={value} onChange={onChange} />
            </FormBlock>
          )}
        />

        <Controller
          control={control}
          name="location"
          render={({ field: { value, onChange } }) => {
            const locationError = translateError(firstErrorMessage(errors.location));
            return (
              <FormBlock
                title={t('requests:form.where')}
                error={locationError}
                onLayout={(event) => rememberPosition('location')(event.nativeEvent.layout.y)}
              >
                <AddressField value={value} onChange={onChange} error={locationError} initialRegion={initialRegion} />
              </FormBlock>
            );
          }}
        />

        <Controller
          control={control}
          name="photos"
          render={({ field: { value, onChange } }) => (
            <FormBlock
              title={t('requests:form.photos')}
              optional
              error={translateError(firstErrorMessage(errors.photos))}
              onLayout={(event) => rememberPosition('photos')(event.nativeEvent.layout.y)}
            >
              <PhotosField value={value} onChange={onChange} />
            </FormBlock>
          )}
        />

        {draft ? (
          <Button
            label={t('customer:details.draft.delete')}
            variant="dangerGhost"
            loading={busy === 'delete'}
            disabled={busy !== null}
            onPress={() => void removeDraft()}
            style={styles.deleteDraft}
            testID="request-form-delete-draft"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  skeleton: {
    gap: t.spacing.lg,
    paddingTop: t.spacing.lg,
  },
  body: {
    gap: t.layout.sectionGap,
    paddingTop: t.spacing.lg,
  },
  footer: {
    gap: t.spacing.sm,
  },
  deleteDraft: {
    alignSelf: 'center',
  },
}));
