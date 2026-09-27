/**
 * `/requests/new?categoryId=&draftId=` – the customer's request wizard:
 * Service → Details → Location → Urgency & timing → Review, then publish or save as a draft.
 * Continuing a draft (`draftId`) prefills the wizard and saves through the draft endpoints.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  SkeletonCard,
  Stepper,
  useConfirm,
  useErrorText,
  useToast,
} from '@/components/ui';
import { isSupportedCategoryId } from '@/constants/professional-categories';
import type { RequestStatus } from '@/constants/request-statuses';
import { useSession } from '@/features/auth/session-provider';
import {
  useCreateRequest,
  useCustomerProfile,
  usePublishRequest,
  useRequest,
  useRouteParam,
  useUpdateDraftRequest,
  useUploadImage,
} from '@/hooks';
import { routes } from '@/lib/routes';
import {
  createEmptyRequestFormValues,
  requestFormSchema,
  requestToFormValues,
  toCreateRequestPayload,
  toUpdateDraftRequestPayload,
  vm,
  type RequestFormLocation,
  type RequestFormValues,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import { makeStyles, useTheme } from '@/theme';
import type { CustomerRequestView } from '@/types/domain';
import { regionForRadius, type MapRegion } from '@/utils/geo';

import { DetailsStep } from '../components/create/details-step';
import type { RequestFormOutput } from '../components/create/form-types';
import { LocationStep } from '../components/create/location-step';
import { ReviewStep } from '../components/create/review-step';
import { ScheduleStep } from '../components/create/schedule-step';
import { ServiceStep } from '../components/create/service-step';
import {
  apiFieldToFormField,
  firstStepWithError,
  getInitialStepIndex,
  photosToUpload,
  REQUEST_WIZARD_STEPS,
  REVIEW_STEP_INDEX,
  STEP_FIELDS,
  toUploadPayload,
  type RequestFormField,
} from '../components/create/wizard-model';

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

  // The "already published" guard looks at the draft as first loaded: publishing from the wizard
  // re-seeds the cached request as `open`, and reacting to that would replace the wizard before it
  // navigates to the published request.
  const [loadedStatus, setLoadedStatus] = useState<{ id: string; status: RequestStatus } | null>(null);
  if (draft && loadedStatus?.id !== draft.id) setLoadedStatus({ id: draft.id, status: draft.status });
  const initialStatus = draft ? (loadedStatus?.id === draft.id ? loadedStatus.status : draft.status) : null;

  if (role !== 'customer') {
    // Only customers post requests (e.g. a professional opening a deep link).
    return (
      <WizardShell>
        <EmptyState
          icon="account-lock-outline"
          title={t('requests:customersOnly.title')}
          description={t('requests:customersOnly.description')}
          actionLabel={role ? t('requests:customersOnly.action') : undefined}
          onAction={role ? () => router.replace(routes.homeFor(role)) : undefined}
        />
      </WizardShell>
    );
  }

  if (draftId) {
    if (draftQuery.isError) {
      return (
        <WizardShell>
          <ErrorState error={draftQuery.error} onRetry={() => void draftQuery.refetch()} retrying={draftQuery.isRefetching} />
        </WizardShell>
      );
    }
    if (draft && initialStatus !== 'draft') {
      return (
        <WizardShell>
          <EmptyState
            icon="send-check-outline"
            title={t('requests:alreadyPublished.title')}
            description={t('requests:alreadyPublished.description')}
            actionLabel={t('requests:alreadyPublished.action')}
            onAction={() => router.dismissTo(routes.request(draft.id))}
          />
        </WizardShell>
      );
    }
  }

  if ((draftId && !draft) || !profileReady) {
    return (
      <WizardShell>
        <WizardSkeleton />
      </WizardShell>
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
  const defaultValues = draft ? requestToFormValues(draft) : createEmptyRequestFormValues({ categoryId, location });
  const initialRegion = defaultLocation ? regionForRadius(defaultLocation.coordinates, DEFAULT_ADDRESS_RADIUS_KM) : undefined;

  return (
    <RequestWizard
      key={draft?.id ?? 'new'}
      draft={draft ?? null}
      defaultValues={defaultValues}
      initialStep={getInitialStepIndex({ isDraft: Boolean(draft), hasCategory: Boolean(categoryId) })}
      initialRegion={initialRegion}
    />
  );
}

function WizardShell({ children }: { children: ReactNode }) {
  return <Screen edges={['left', 'right', 'bottom']}>{children}</Screen>;
}

function WizardSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.skeleton}>
      <Skeleton height={4} />
      <Skeleton width="70%" height={24} />
      <Skeleton width="90%" height={14} />
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </View>
  );
}

interface RequestWizardProps {
  draft: CustomerRequestView | null;
  defaultValues: RequestFormValues;
  initialStep: number;
  initialRegion?: MapRegion;
}

type SubmitAction = 'publish' | 'draft';

function RequestWizard({ draft, defaultValues, initialStep, initialRegion }: RequestWizardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation(['requests', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const errorText = useErrorText();
  const scrollRef = useRef<ScrollView>(null);
  const upload = useUploadImage();
  const createRequest = useCreateRequest();
  const updateDraft = useUpdateDraftRequest();
  const publishRequest = usePublishRequest();

  const form = useForm<RequestFormValues, unknown, RequestFormOutput>({
    resolver: zodResolver(requestFormSchema),
    defaultValues,
    mode: 'onTouched',
  });
  const { control, trigger, handleSubmit, getValues, setValue, setError } = form;
  const { isDirty } = form.formState;

  const [step, setStep] = useState(initialStep);
  const [pendingAction, setPendingAction] = useState<SubmitAction | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(null);
  const stepKey = REQUEST_WIZARD_STEPS[step];
  const isReview = step === REVIEW_STEP_INDEX;
  const busy = pendingAction !== null;

  // Leaving with unsaved changes asks first (header back, gestures, hardware back).
  usePreventRemove((isDirty || busy) && !completedRequestId, ({ data }) => {
    void confirm({
      title: t('common:confirm.discardTitle'),
      message: draft ? t('requests:leave.draftMessage') : t('requests:leave.message'),
      confirmLabel: t('common:actions.discard'),
      cancelLabel: t('requests:leave.keepEditing'),
      destructive: true,
      icon: 'file-document-remove-outline',
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  // Navigate only after the guard above was lifted by the completed state. A draft returns to its
  // request page when that is on the stack (never a second copy of it); a new request replaces the
  // wizard.
  const editingDraft = draft !== null;
  useEffect(() => {
    if (!completedRequestId) return;
    const href = routes.request(completedRequestId);
    if (editingDraft) router.dismissTo(href);
    else router.replace(href);
  }, [completedRequestId, editingDraft, router]);

  const goTo = (index: number) => {
    setStep(Math.min(Math.max(index, 0), REVIEW_STEP_INDEX));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goNext = async () => {
    const fields = STEP_FIELDS[stepKey];
    // Mark the step's fields as touched so errors clear as soon as they are fixed ('onTouched' mode).
    for (const field of fields) setValue(field, getValues(field), { shouldTouch: true });
    const valid = await trigger([...fields], { shouldFocus: true });
    if (valid) goTo(step + 1);
  };

  const goBack = () => {
    if (step > 0) goTo(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace(routes.customer.home); // opened directly (deep link, web refresh)
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
    const text = errorText(error);
    if (fields.length > 0) {
      goTo(firstStepWithError(fields));
      setSubmitError(null);
      toast.show({ title: t('requests:submit.fixFields'), message: text.description, tone: 'warning' });
    } else {
      setSubmitError(text.description);
      toast.show({ title: text.title, message: text.description, tone: 'danger' });
    }
  };

  const save = async (values: RequestFormOutput, action: SubmitAction) => {
    setPendingAction(action);
    setSubmitError(null);
    try {
      // 1. Upload new photos (already uploaded ones keep their id, also across retries).
      let photos = getValues('photos');
      const pending = photosToUpload(photos);
      if (pending.length > 0) setUploadProgress({ done: 0, total: pending.length });
      for (const [index, photo] of pending.entries()) {
        const uploaded = await upload.mutateAsync(toUploadPayload(photo));
        photos = photos.map((item) => (item.uri === photo.uri ? { ...item, uploadId: uploaded.id } : item));
        setValue('photos', photos);
        setUploadProgress({ done: index + 1, total: pending.length });
      }
      setUploadProgress(null);
      const photoIds = photos.flatMap((photo) => (photo.uploadId ? [photo.uploadId] : []));
      const formValues: RequestFormValues = { ...values, photos };

      // 2. Create, or update (and publish) the draft.
      const publish = action === 'publish';
      let saved;
      if (draft) {
        saved = await updateDraft.mutateAsync({ requestId: draft.id, payload: toUpdateDraftRequestPayload(formValues, photoIds) });
        if (publish) saved = await publishRequest.mutateAsync(draft.id);
      } else {
        saved = await createRequest.mutateAsync(toCreateRequestPayload(formValues, photoIds, publish));
      }

      toast.show(
        publish
          ? { title: t('requests:submit.published'), message: t('requests:submit.publishedMessage'), tone: 'success', icon: 'send-check-outline' }
          : { title: t('requests:submit.draftSaved'), message: t('requests:submit.draftSavedMessage'), tone: 'neutral', icon: 'content-save-outline' },
      );
      setCompletedRequestId(saved.id);
    } catch (error) {
      applyServerErrors(error);
    } finally {
      setPendingAction(null);
      setUploadProgress(null);
    }
  };

  const submit = (action: SubmitAction) =>
    handleSubmit(
      (values) => save(values, action),
      (errors) => {
        const fields = Object.keys(errors) as RequestFormField[];
        goTo(firstStepWithError(fields));
        toast.show({ title: t('requests:submit.fixFields'), tone: 'warning' });
      },
    )();

  const stepTitles = REQUEST_WIZARD_STEPS.map((key) => t(`requests:steps.${key}`));
  const title = draft ? t('requests:titleEditDraft') : t('common:screens.newRequest');

  const footer = isReview ? (
    <View style={styles.footer}>
      {uploadProgress ? (
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <AppText variant="captionStrong" color="primary">
            {t('requests:submit.uploading', {
              current: Math.min(uploadProgress.done + 1, uploadProgress.total),
              total: uploadProgress.total,
            })}
          </AppText>
        </View>
      ) : null}
      <Button
        label={t('requests:submit.publish')}
        leftIcon="send-outline"
        flipIconsInRTL
        size="lg"
        fullWidth
        loading={pendingAction === 'publish'}
        disabled={busy}
        onPress={() => void submit('publish')}
        testID="wizard-publish"
      />
      <Button
        label={t('requests:submit.saveDraft')}
        leftIcon="content-save-outline"
        variant="secondary"
        fullWidth
        loading={pendingAction === 'draft'}
        disabled={busy}
        onPress={() => void submit('draft')}
        testID="wizard-save-draft"
      />
    </View>
  ) : (
    <View style={styles.footerRow}>
      <Button
        label={step === 0 ? t('common:actions.cancel') : t('common:actions.back')}
        variant="outline"
        leftIcon={step === 0 ? undefined : 'arrow-left'}
        flipIconsInRTL
        onPress={goBack}
        style={styles.backButton}
        testID="wizard-back"
      />
      <Button
        label={step === REVIEW_STEP_INDEX - 1 ? t('requests:review.cta') : t('common:actions.next')}
        rightIcon="arrow-right"
        flipIconsInRTL
        onPress={() => void goNext()}
        style={styles.nextButton}
        testID="wizard-next"
      />
    </View>
  );

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      scrollRef={scrollRef}
      header={<Stepper steps={stepTitles} current={step} style={styles.stepper} />}
      footer={footer}
      testID="create-request-wizard"
    >
      <Stack.Screen options={{ title }} />
      <View style={styles.body}>
        {stepKey === 'service' ? <ServiceStep control={control} onPicked={() => void goNext()} /> : null}
        {stepKey === 'details' ? <DetailsStep control={control} onChangeService={() => goTo(0)} /> : null}
        {stepKey === 'location' ? <LocationStep control={control} initialRegion={initialRegion} /> : null}
        {stepKey === 'schedule' ? <ScheduleStep control={control} /> : null}
        {stepKey === 'review' ? <ReviewStep control={control} onEdit={goTo} submitError={submitError} /> : null}
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  skeleton: {
    gap: t.spacing.lg,
  },
  stepper: {
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  body: {
    paddingTop: t.spacing.sm,
  },
  footer: {
    gap: t.spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
}));
