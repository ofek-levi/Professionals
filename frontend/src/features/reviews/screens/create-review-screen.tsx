/**
 * `/jobs/:jobId/review` – the customer rates a completed job (1–5 stars and an optional comment).
 * Handles "already reviewed" (also a CONFLICT from the server), a professional who deleted their
 * account (reviews closed; the CONFLICT path refetches the job and lands there), jobs that are not
 * completed yet and shows a thank-you state; the job and the professional's profile refresh
 * automatically through the mutation's invalidation.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FormTextField, useTranslatedError } from '@/components/forms';
import { ReviewCard } from '@/components/professionals';
import {
  AppText,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  InlineAlert,
  RatingInput,
  Screen,
  Skeleton,
  useConfirm,
  useErrorText,
  useToast,
} from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useSession } from '@/features/auth';
import { isRating } from '@/features/reviews/rating';
import { useCreateReview, useJob, useRouteParam } from '@/hooks';
import { useCategoryName, useFormatters, usePersonName } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import {
  createReviewSchema,
  EMPTY_REVIEW_FORM_VALUES,
  reviewFormSchema,
  toCreateReviewPayload,
  type ReviewFormValues,
} from '@/lib/validation';
import { toApiError } from '@/services/api/errors';
import { makeStyles } from '@/theme';
import type { JobDetails, Review } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { ReviewResultState } from '../components/review-result-state';

export default function CreateReviewScreen() {
  const styles = useStyles();
  const { t } = useTranslation(['reviews', 'jobs', 'common']);
  const jobId = useRouteParam('jobId');
  const { role } = useSession();
  const query = useJob(role === 'customer' ? jobId : null);

  if (role !== 'customer' || !jobId) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <EmptyState icon="account-lock-outline" title={t('reviews:notAllowed.title')} description={t('reviews:notAllowed.description')} />
      </Screen>
    );
  }

  if (query.data === undefined) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="lg" testID="review-loading">
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <>
            <View style={styles.centered}>
              <Skeleton circle height={72} />
              <Skeleton width="60%" height={22} />
              <Skeleton width="40%" height={13} />
              <Skeleton width="70%" height={40} radius={12} />
            </View>
            <Skeleton height={120} radius={16} />
          </>
        )}
      </Screen>
    );
  }

  return <ReviewFlow job={query.data} onRefetchJob={() => void query.refetch()} />;
}

function ReviewFlow({ job, onRefetchJob }: { job: JobDetails; onRefetchJob: () => void }) {
  const router = useRouter();
  const { t } = useTranslation(['reviews', 'common']);
  const [submitted, setSubmitted] = useState<Review | null>(null);
  const [conflict, setConflict] = useState(false);
  const personName = usePersonName();
  const name = personName(job.professional);
  const backToJob = () => router.dismissTo(routes.job(job.id));

  if (submitted) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID="review-success">
        <ReviewResultState
          icon="heart"
          tone="success"
          title={t('reviews:success.title')}
          description={t('reviews:success.description', { name: isolateText(name) })}
          rating={submitted.rating}
          primaryLabel={t('reviews:success.backToJob')}
          onPrimary={backToJob}
          secondaryLabel={t('reviews:success.home')}
          onSecondary={() => router.dismissTo(routes.customer.home)}
        />
      </Screen>
    );
  }

  if (!job.review && job.professional.accountDeleted) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID="review-closed">
        <EmptyState
          icon="account-off-outline"
          title={t('reviews:closed.title')}
          description={t('reviews:closed.description')}
          actionLabel={t('reviews:success.backToJob')}
          onAction={backToJob}
        />
      </Screen>
    );
  }

  if (job.review || conflict) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID="review-already">
        <ReviewResultState
          icon="star-check"
          tone="brand"
          title={t('reviews:alreadyReviewed.title')}
          description={job.review ? t('reviews:alreadyReviewed.description') : t('reviews:alreadyReviewed.descriptionNoReview')}
          primaryLabel={t('reviews:success.backToJob')}
          onPrimary={backToJob}
        >
          {job.review ? <ReviewCard review={job.review} hideAuthor /> : null}
        </ReviewResultState>
      </Screen>
    );
  }

  if (job.status !== 'completed') {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID="review-not-completed">
        <EmptyState
          icon="progress-clock"
          tone="warning"
          title={t('reviews:notCompleted.title')}
          description={t('reviews:notCompleted.description')}
          actionLabel={t('reviews:success.backToJob')}
          onAction={backToJob}
        />
      </Screen>
    );
  }

  return (
    <ReviewForm
      job={job}
      onSubmitted={setSubmitted}
      onConflict={() => {
        setConflict(true);
        onRefetchJob();
      }}
    />
  );
}

function ReviewForm({
  job,
  onSubmitted,
  onConflict,
}: {
  job: JobDetails;
  onSubmitted: (review: Review) => void;
  onConflict: () => void;
}) {
  const styles = useStyles();
  const navigation = useNavigation();
  const { t } = useTranslation(['reviews', 'common']);
  const confirm = useConfirm();
  const toast = useToast();
  const errorText = useErrorText();
  const translateError = useTranslatedError();
  const createReview = useCreateReview();
  const { control, handleSubmit, setError, formState } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: EMPTY_REVIEW_FORM_VALUES,
  });
  const format = useFormatters();
  const personName = usePersonName();
  const categoryName = useCategoryName(job.categoryId) || t('common:category.unknown');
  const rating = useWatch({ control, name: 'rating' }) ?? 0;
  const pending = createReview.isPending;
  const name = personName(job.professional);

  usePreventRemove(formState.isDirty && !pending && !createReview.isSuccess, ({ data }) => {
    void confirm({
      title: t('common:confirm.discardTitle'),
      message: t('common:confirm.discardMessage'),
      confirmLabel: t('common:actions.discard'),
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  const submit = handleSubmit(async (formValues) => {
    const parsed = createReviewSchema.safeParse(toCreateReviewPayload(formValues));
    if (!parsed.success) return;
    try {
      const review = await createReview.mutateAsync({ jobId: job.id, payload: parsed.data });
      onSubmitted(review);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === 'CONFLICT') {
        onConflict();
        return;
      }
      const fields = apiError.fieldErrors ?? {};
      let hasFieldError = false;
      (['rating', 'comment'] as const).forEach((field) => {
        const message = fields[field]?.[0];
        if (message) {
          hasFieldError = true;
          setError(field, { type: 'server', message });
        }
      });
      const { title, description } = errorText(error);
      toast.show({ title: hasFieldError ? t('reviews:create.errorTitle') : title, message: description, tone: 'danger' });
    }
  });

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      gap="xxl"
      footer={
        <View style={styles.footer}>
          {rating === 0 ? (
            <AppText variant="caption" color="muted" align="center">
              {t('reviews:create.ratingRequiredHint')}
            </AppText>
          ) : null}
          <Button
            label={t('reviews:create.submit')}
            size="lg"
            fullWidth
            loading={pending}
            disabled={rating === 0 || pending}
            onPress={() => void submit()}
            testID="review-submit"
          />
        </View>
      }
      testID="review-form"
    >
      <View style={styles.centered}>
        <Avatar name={name} uri={job.professional.avatarUrl} size={72} decorative />
        <View style={styles.centeredTexts}>
          <AppText variant="title" align="center" accessibilityRole="header">
            {t('reviews:create.ratingTitle', { name: isolateText(name) })}
          </AppText>
          <AppText variant="caption" color="muted" align="center">
            {`${categoryName} · ${format.date(job.completedAt ?? job.scheduledStartAt, 'medium')}`}
          </AppText>
        </View>
        <Controller
          control={control}
          name="rating"
          render={({ field, fieldState }) => (
            <View style={styles.centeredTexts}>
              <RatingInput
                value={isRating(field.value) ? field.value : null}
                onChange={(value) => field.onChange(value)}
                size={44}
                disabled={pending}
                testID="review-rating"
              />
              {fieldState.error ? (
                <AppText variant="caption" color="danger" align="center">
                  {translateError(fieldState.error.message)}
                </AppText>
              ) : null}
            </View>
          )}
        />
      </View>

      <FormTextField
        control={control}
        name="comment"
        label={t('reviews:create.commentLabel')}
        optional
        placeholder={t('reviews:create.commentPlaceholder')}
        multiline
        minRows={4}
        maxLength={APP_CONFIG.reviewCommentMaxLength}
        disabled={pending}
        testID="review-comment"
      />

      {createReview.isError && toApiError(createReview.error).code === 'NETWORK_ERROR' ? (
        <InlineAlert tone="warning" message={errorText(createReview.error).description} />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  centered: {
    alignItems: 'center',
    gap: t.spacing.lg,
    paddingTop: t.spacing.lg,
  },
  centeredTexts: {
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  footer: {
    gap: t.spacing.sm,
  },
}));
