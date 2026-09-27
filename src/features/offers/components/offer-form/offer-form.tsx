/**
 * Create / edit an offer: price, appointment date + time (limited by the urgency window, with the
 * professional's working hours and soft warnings), duration, message with quick templates and a
 * live preview of how the customer will see it.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { DateSlotPicker, DurationPicker, FormSection, FormTextField, PriceInput, TimeSlotPicker, useTranslatedError } from '@/components/forms';
import { AppText, Button, Icon, InlineAlert, Screen, useConfirm, useErrorToast, useNow, useToast } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { OFFER_TIME_RULES, validateOfferAgainstRequest } from '@/features/offers/offer-rules';
import { getWorkingHoursForDate } from '@/features/profiles/availability';
import { useCreateOffer, useUpdateOffer, type OfferDetails } from '@/hooks';
import { useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import {
  createEmptyOfferFormValues,
  createOfferFormSchema,
  offerToFormValues,
  parseAmountInput,
  toCreateOfferPayload,
  toUpdateOfferPayload,
  type OfferFormValues,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import { makeStyles } from '@/theme';
import type { OwnProfessionalProfile, ProfessionalRequestView } from '@/types/domain';
import { parseDateKey, tryCombineDateAndTime } from '@/utils/dates';
import { isolateText } from '@/utils/bidi';

import { MessageTemplates } from './message-templates';
import {
  appendTemplate,
  mapOfferServerFieldErrors,
  offerDateDays,
  offerTimeRange,
  suggestOfferStart,
  toOfferSubmitProblem,
  type OfferSubmitProblem,
} from './offer-form-model';
import { OfferPreviewCard } from './offer-preview-card';
import { RequestSummaryHeader } from './request-summary-header';

type OfferFormOutput = z.output<ReturnType<typeof createOfferFormSchema>>;

export interface OfferFormProps {
  request: ProfessionalRequestView;
  /** The offer being edited (edit mode). */
  offer: OfferDetails | null;
  profile: OwnProfessionalProfile | undefined;
}

export function OfferForm({ request, offer, profile }: OfferFormProps) {
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useTranslation(['offers', 'errors', 'common']);
  const format = useFormatters();
  const translateError = useTranslatedError();
  const confirm = useConfirm();
  const toast = useToast();
  const showError = useErrorToast();
  const now = useNow(60_000);
  const scrollRef = useRef<ScrollView>(null);
  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();
  const isEdit = offer !== null;
  const availability = profile?.availability ?? null;
  const currency = offer?.currency ?? APP_CONFIG.defaultCurrency;

  const [defaults] = useState<OfferFormValues>(() => {
    if (offer) return offerToFormValues(offer);
    const suggestion = suggestOfferStart({ request, availability, now: new Date() });
    return { ...createEmptyOfferFormValues(), date: suggestion?.date ?? '', time: suggestion?.time ?? '' };
  });
  const [schema] = useState(() => createOfferFormSchema(() => new Date(), { request }));
  const { control, handleSubmit, setError, setValue, formState } = useForm<OfferFormValues, unknown, OfferFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const values = useWatch({ control }) as OfferFormValues;
  const [problem, setProblem] = useState<OfferSubmitProblem | null>(null);
  const [savedOfferId, setSavedOfferId] = useState<string | null>(null);
  const pending = createOffer.isPending || updateOffer.isPending;

  usePreventRemove(formState.isDirty && savedOfferId === null && !pending, ({ data }) => {
    void confirm({
      title: isEdit ? t('offers:form.discard.editTitle') : t('offers:form.discard.title'),
      message: t('offers:form.discard.message'),
      confirmLabel: t('common:actions.discard'),
      cancelLabel: t('offers:form.discard.keepEditing'),
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  // Navigate once the "saved" state has rendered, so the unsaved-changes guard is already off. An
  // edited offer returns to its details when they are on the stack (never a second copy of them);
  // a new offer replaces the form.
  useEffect(() => {
    if (!savedOfferId) return;
    const href = routes.offer(savedOfferId);
    if (isEdit) router.dismissTo(href);
    else router.replace(href);
  }, [savedOfferId, isEdit, router]);

  // Business conflicts are shown in a banner at the top: bring it into view.
  useEffect(() => {
    if (problem) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [problem]);

  // Live, non-blocking checks of the chosen time (preferred date/window, working hours).
  const startAt = tryCombineDateAndTime(values.date ?? '', values.time ?? '');
  const warnings = startAt
    ? validateOfferAgainstRequest({
        proposedStartAt: startAt,
        request,
        now,
        availability,
        estimatedDurationMinutes: values.estimatedDurationMinutes ?? null,
      }).warnings
    : [];
  const selectedDay = values.date ? parseDateKey(values.date) : null;
  const workingHours = availability && selectedDay ? getWorkingHoursForDate(availability, selectedDay) : null;
  const range = offerTimeRange(request.urgency);
  const price = parseAmountInput(values.price ?? '');

  const submit = handleSubmit(async (formValues) => {
    setProblem(null);
    try {
      const input = formValues as OfferFormValues;
      const saved = isEdit
        ? await updateOffer.mutateAsync({ offerId: offer.id, payload: toUpdateOfferPayload(input, currency) })
        : await createOffer.mutateAsync({ requestId: request.id, payload: toCreateOfferPayload(input, currency) });
      toast.show({
        title: isEdit ? t('offers:form.updated') : t('offers:form.sent'),
        message: isEdit ? t('offers:form.updatedMessage') : t('offers:form.sentMessage', { name: isolateText(request.customer.displayName) }),
        tone: 'success',
        icon: 'check-circle-outline',
      });
      setSavedOfferId(saved.id);
    } catch (error) {
      const apiError = toApiError(error);
      const businessProblem = toOfferSubmitProblem(apiError.code);
      if (businessProblem) {
        setProblem(businessProblem);
        return;
      }
      const fieldErrors = mapOfferServerFieldErrors(apiError.fieldErrors);
      const entries = Object.entries(fieldErrors) as [keyof OfferFormValues, string][];
      entries.forEach(([field, message]) => setError(field, { type: 'server', message }));
      showError(error, entries.length > 0 ? { title: t('offers:form.fixFields') } : undefined);
    }
  });

  const problemAction = (() => {
    switch (problem) {
      case 'DUPLICATE_OFFER':
      case 'REQUEST_NOT_ACCEPTING_OFFERS':
        return { label: t('offers:form.problem.backToRequest'), onPress: () => router.dismissTo(routes.request(request.id)) };
      case 'OUTSIDE_SERVICE_AREA':
      case 'UNSUPPORTED_CATEGORY':
        return { label: t('offers:form.problem.editProfile'), onPress: () => router.push(routes.editProfile) };
      case 'OFFER_EXPIRED':
        return offer ? { label: t('offers:actions.viewOffer'), onPress: () => router.dismissTo(routes.offer(offer.id)) } : null;
      default:
        return null;
    }
  })();

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      gap="xl"
      scrollRef={scrollRef}
      footer={
        <Button
          label={
            isEdit
              ? t('offers:form.submitEdit')
              : price !== null
                ? t('offers:form.submitWithPrice', { price: format.currency(price, currency) })
                : t('offers:form.submit')
          }
          leftIcon={isEdit ? 'content-save-outline' : 'send'}
          flipIconsInRTL={!isEdit}
          size="lg"
          fullWidth
          loading={pending}
          disabled={pending || (isEdit && !formState.isDirty)}
          onPress={() => void submit()}
          testID="offer-form-submit"
        />
      }
      testID="offer-form"
    >
      {problem ? (
        <InlineAlert
          tone="danger"
          title={t(`offers:form.problemTitle.${problem}`)}
          message={t(`offers:form.problem.${problem}`)}
          actionLabel={problemAction?.label}
          onAction={problemAction?.onPress}
          onDismiss={() => setProblem(null)}
          testID="offer-form-problem"
        />
      ) : null}

      <RequestSummaryHeader request={request} onPress={() => router.push(routes.request(request.id))} />

      <FormSection title={t('offers:form.price.title')} description={t('offers:form.price.description')} icon="cash-multiple">
        <Controller
          control={control}
          name="price"
          render={({ field, fieldState }) => (
            <PriceInput
              ref={field.ref}
              label={t('offers:form.price.label')}
              required
              value={parseAmountInput(field.value)}
              onChange={(amount) => field.onChange(amount === null ? '' : String(amount))}
              onBlur={field.onBlur}
              currency={currency}
              placeholder={t('offers:form.price.placeholder')}
              helperText={t('offers:form.price.helper', { min: format.currency(APP_CONFIG.minOfferPrice, currency) })}
              error={translateError(fieldState.error?.message)}
              testID="offer-form-price"
            />
          )}
        />
      </FormSection>

      <FormSection title={t('offers:form.when.title')} description={t('offers:form.when.description')} icon="calendar-clock">
        <Controller
          control={control}
          name="date"
          render={({ field, fieldState }) => (
            <DateSlotPicker
              label={t('offers:form.when.date')}
              required
              value={field.value || null}
              onChange={(date) => {
                field.onChange(date);
                field.onBlur();
              }}
              days={offerDateDays(request.urgency, now)}
              error={translateError(fieldState.error?.message)}
              testID="offer-form-date"
            />
          )}
        />
        {availability && selectedDay ? (
          <View style={styles.hours}>
            <Icon name={workingHours ? 'briefcase-clock-outline' : 'sleep'} size={16} color="secondary" />
            <AppText variant="caption" color="secondary" style={styles.flex}>
              {workingHours
                ? t('offers:form.when.workingHours', { day: format.date(selectedDay, 'weekday'), start: workingHours.start, end: workingHours.end })
                : t('offers:form.when.dayOff', { day: format.date(selectedDay, 'weekday') })}
            </AppText>
          </View>
        ) : null}
        <Controller
          control={control}
          name="time"
          render={({ field, fieldState }) => (
            <TimeSlotPicker
              label={t('offers:form.when.time')}
              required
              value={field.value || null}
              onChange={(time) => {
                field.onChange(time);
                field.onBlur();
              }}
              date={values.date || null}
              startTime={range.start}
              endTime={range.end}
              minLeadMinutes={OFFER_TIME_RULES.minLeadMinutes}
              error={translateError(fieldState.error?.message)}
              testID="offer-form-time"
            />
          )}
        />
        {warnings.map((warning) => (
          <InlineAlert key={warning.code} tone="warning" message={translateError(warning.message) ?? ''} testID={`offer-warning-${warning.code}`} />
        ))}
      </FormSection>

      <FormSection title={t('offers:form.duration.title')} icon="timer-outline" optional>
        <Controller
          control={control}
          name="estimatedDurationMinutes"
          render={({ field, fieldState }) => (
            <DurationPicker
              value={field.value}
              onChange={(minutes) => field.onChange(minutes)}
              optional
              helperText={t('offers:form.duration.helper')}
              error={translateError(fieldState.error?.message)}
            />
          )}
        />
      </FormSection>

      <FormSection title={t('offers:form.message.title')} description={t('offers:form.message.description')} icon="message-text-outline" optional>
        <MessageTemplates
          name={profile?.fullName.split(/\s+/)[0] ?? ''}
          onInsert={(text) =>
            setValue('message', appendTemplate(values.message ?? '', text, APP_CONFIG.offerMessageMaxLength), {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <FormTextField
          control={control}
          name="message"
          label={t('offers:form.message.label')}
          placeholder={t('offers:form.message.placeholder')}
          multiline
          minRows={4}
          maxLength={APP_CONFIG.offerMessageMaxLength}
          showCounter
          testID="offer-form-message"
        />
      </FormSection>

      {profile ? (
        <OfferPreviewCard
          profile={profile}
          categoryId={request.categoryId}
          distanceKm={request.distanceKm}
          price={price}
          currency={currency}
          proposedStartAt={startAt}
          estimatedDurationMinutes={values.estimatedDurationMinutes ?? null}
          message={values.message?.trim() ? values.message.trim() : null}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  hours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceMuted,
  },
  flex: {
    flex: 1,
  },
}));
