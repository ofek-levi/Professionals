/**
 * Create / edit an offer in a few taps: price, day (next 7 days within the urgency window), time
 * (30-minute slots within the working hours, or 07:00–20:00) and an optional message. Sends
 * without a confirmation, then returns to the request.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

import { FormTextField, useTranslatedError } from '@/components/forms';
import { AppText, Button, Field, InlineAlert, Screen, useErrorToast, useNow, useToast } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useCreateOffer, useUpdateOffer, type OfferDetails } from '@/hooks';
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
import type { ISODateString, OwnProfessionalProfile, ProfessionalRequestView, TimeOfDayString } from '@/types/domain';
import { timeToMinutes } from '@/utils/dates';

import {
  mapOfferServerFieldErrors,
  offerDateOptions,
  offerTimeSlots,
  suggestOfferStart,
  toOfferSubmitProblem,
  urgencyWindowHours,
  type OfferDateOption,
  type OfferSubmitProblem,
} from './offer-form-model';
import { DayTiles, LargePriceInput, TimeGrid } from './offer-pickers';

type OfferFormOutput = z.output<ReturnType<typeof createOfferFormSchema>>;

interface OfferFormProps {
  request: ProfessionalRequestView;
  /** The offer being edited (edit mode). */
  offer: OfferDetails | null;
  profile: OwnProfessionalProfile | undefined;
}

export function OfferForm({ request, offer, profile }: OfferFormProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['offers', 'common']);
  const translateError = useTranslatedError();
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
  const { control, handleSubmit, setError, setValue, getValues, formState } = useForm<OfferFormValues, unknown, OfferFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  });
  const date = useWatch({ control, name: 'date' });
  const [showMessage, setShowMessage] = useState(() => defaults.message.trim().length > 0);
  const [problem, setProblem] = useState<OfferSubmitProblem | null>(null);
  const pending = createOffer.isPending || updateOffer.isPending;

  // Business conflicts are shown in a banner at the top: bring it into view.
  useEffect(() => {
    if (problem) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [problem]);

  const slotInput = { urgency: request.urgency, availability, now };
  const dateOptions = withValue<OfferDateOption>(offerDateOptions(slotInput), defaults.date, (value) => ({ date: value, disabled: false }), (a) => a.date);
  const freeTimes = (day: string): TimeOfDayString[] =>
    day ? offerTimeSlots({ ...slotInput, date: day }).filter((slot) => !slot.disabled).map((slot) => slot.time) : [];
  // An edited offer keeps its own day and time selectable even when they are outside today's grid.
  const times = withValue(freeTimes(date), date === defaults.date ? defaults.time : '', (value) => value, (value) => value).sort(
    (a, b) => timeToMinutes(a) - timeToMinutes(b),
  );
  const windowHours = urgencyWindowHours(request.urgency);

  // A new day keeps the chosen time when it is free, else the next free time (or the first one).
  const pickDate = (next: ISODateString) => {
    setValue('date', next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    const current = getValues('time');
    const available = freeTimes(next);
    if (current && available.includes(current)) return;
    const later = current ? available.find((time) => timeToMinutes(time) >= timeToMinutes(current)) : undefined;
    setValue('time', later ?? available[0] ?? '', { shouldDirty: true, shouldValidate: formState.isSubmitted });
  };

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(routes.request(request.id));
  };

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      const input = values as OfferFormValues;
      if (isEdit) await updateOffer.mutateAsync({ offerId: offer.id, payload: toUpdateOfferPayload(input, currency) });
      else await createOffer.mutateAsync({ requestId: request.id, payload: toCreateOfferPayload(input, currency) });
      toast.show({ title: isEdit ? t('offers:form.updated') : t('offers:form.sent'), tone: 'success' });
      leave();
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
      case 'OFFER_EXPIRED':
        return { label: t('offers:form.problem.backToRequest'), onPress: leave };
      case 'OUTSIDE_SERVICE_AREA':
      case 'UNSUPPORTED_CATEGORY':
        return { label: t('offers:form.problem.editProfile'), onPress: () => router.push(routes.editProfile) };
      default:
        return null;
    }
  })();

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      scrollRef={scrollRef}
      contentContainerStyle={styles.content}
      footer={
        <Button
          label={isEdit ? t('offers:form.submitEdit') : t('offers:form.submit')}
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

      <Controller
        control={control}
        name="price"
        render={({ field, fieldState }) => (
          <Block title={t('offers:form.price')} error={translateError(fieldState.error?.message)}>
            <LargePriceInput
              ref={field.ref}
              value={parseAmountInput(field.value)}
              onChange={(amount) => field.onChange(amount === null ? '' : String(amount))}
              onBlur={field.onBlur}
              currency={currency}
              accessibilityLabel={t('offers:form.price')}
              invalid={Boolean(fieldState.error)}
              testID="offer-form-price"
            />
          </Block>
        )}
      />

      <Controller
        control={control}
        name="date"
        render={({ fieldState }) => (
          <Block
            title={t('offers:form.date')}
            hint={
              windowHours === null
                ? undefined
                : t('offers:form.urgencyHint', { urgency: t(`common:urgency.${request.urgency}.label`), hours: windowHours })
            }
            error={translateError(fieldState.error?.message)}
          >
            <DayTiles options={dateOptions} value={date || null} onChange={pickDate} now={now} testID="offer-form-date" />
          </Block>
        )}
      />

      <Controller
        control={control}
        name="time"
        render={({ field, fieldState }) => (
          <Block title={t('offers:form.time')} error={translateError(fieldState.error?.message)}>
            {date && times.length === 0 ? (
              <AppText variant="body" color="muted">
                {t('offers:form.noTimes')}
              </AppText>
            ) : (
              <TimeGrid
                times={times}
                value={field.value || null}
                onChange={(time) => {
                  field.onChange(time);
                  field.onBlur();
                }}
                testID="offer-form-time"
              />
            )}
          </Block>
        )}
      />

      {showMessage ? (
        <FormTextField
          control={control}
          name="message"
          label={t('offers:form.message')}
          optional
          placeholder={t('offers:form.messagePlaceholder')}
          multiline
          minRows={3}
          maxLength={APP_CONFIG.offerMessageMaxLength}
          showCounter
          autoFocus={!defaults.message}
          testID="offer-form-message"
        />
      ) : (
        <Button
          label={t('offers:form.addMessage')}
          variant="ghost"
          size="sm"
          leftIcon="plus"
          onPress={() => setShowMessage(true)}
          style={styles.addMessage}
          testID="offer-form-add-message"
        />
      )}
    </Screen>
  );
}

/** Adds `value` (when set and missing) to a list of options – e.g. the day or time of an edited offer. */
function withValue<T>(list: T[], value: string, create: (value: string) => T, key: (item: T) => string): T[] {
  if (!value || list.some((item) => key(item) === value)) return list;
  return [...list, create(value)];
}

function Block({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <AppText variant="subheading" accessibilityRole="header">
          {title}
        </AppText>
        {hint ? (
          <AppText variant="caption" color="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Field error={error}>{children}</Field>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    gap: t.spacing.xxl,
    paddingTop: t.spacing.lg,
  },
  block: {
    gap: t.spacing.md,
  },
  blockHeader: {
    gap: t.spacing.xxs,
  },
  addMessage: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
  },
}));
