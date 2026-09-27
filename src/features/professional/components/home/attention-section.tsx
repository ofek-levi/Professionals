/**
 * "Needs your attention": appointments waiting for the professional's confirmation and pending
 * offers that expire soon.
 */
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { AppText, Button, Card, Divider, Icon, SectionHeader, useConfirm, useErrorText, useToast } from '@/components/ui';
import { ExpiryBadge } from '@/features/offers/components/expiry-badge';
import { useConfirmJob } from '@/hooks';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { JobSummary, OfferWithRequest } from '@/types/domain';

export interface AttentionSectionProps {
  awaitingJobs: JobSummary[];
  expiringOffers: OfferWithRequest[];
}

export function AttentionSection({ awaitingJobs, expiringOffers }: AttentionSectionProps) {
  const styles = useStyles();
  const { t } = useTranslation('professional');
  const total = awaitingJobs.length + expiringOffers.length;
  if (total === 0) return null;

  return (
    <View testID="pro-home-attention">
      <SectionHeader title={t('home.attention.title')} icon="alert-circle-outline" subtitle={t('home.attention.subtitle', { count: total })} />
      <Card padding="none" style={styles.card}>
        {awaitingJobs.map((job, index) => (
          <Fragment key={job.id}>
            {index > 0 ? <Divider inset={68} /> : null}
            <AwaitingJobRow job={job} />
          </Fragment>
        ))}
        {expiringOffers.map((offer, index) => (
          <Fragment key={offer.id}>
            {awaitingJobs.length + index > 0 ? <Divider inset={68} /> : null}
            <ExpiringOfferRow offer={offer} />
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

function AwaitingJobRow({ job }: { job: JobSummary }) {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const confirm = useConfirm();
  const toast = useToast();
  const errorText = useErrorText();
  const confirmJob = useConfirmJob();
  const category = useCategoryName(job.categoryId) || t('common:category.unknown');
  const when = format.dateTime(job.scheduledStartAt);

  const onConfirm = async () => {
    const ok = await confirm({
      title: t('professional:jobs.confirmDialog.title'),
      message: t('professional:jobs.confirmDialog.message', { customer: job.customer.displayName, when }),
      confirmLabel: t('professional:jobs.confirmDialog.confirm'),
      icon: 'calendar-check-outline',
      tone: 'success',
    });
    if (!ok) return;
    confirmJob.mutate(job.id, {
      onSuccess: () => toast.show({ title: t('professional:jobs.confirmed'), tone: 'success', icon: 'calendar-check' }),
      onError: (error) => toast.show({ ...errorText(error), tone: 'danger' }),
    });
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('professional:home.attention.confirmTitle')}, ${category}, ${job.customer.displayName}, ${when}`}
      onPress={() => router.push(routes.job(job.id))}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.iconBox, { backgroundColor: theme.colors.tones.warning.bg }]}>
        <Icon name="calendar-alert" size={22} color="warning" />
      </View>
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {t('professional:home.attention.confirmTitle')}
        </AppText>
        <AppText variant="caption" color="secondary" numberOfLines={2}>
          {t('professional:home.attention.confirmSubtitle', { category, customer: job.customer.displayName, when })}
        </AppText>
      </View>
      <Button
        label={t('professional:jobs.confirmShort')}
        size="sm"
        variant="success"
        loading={confirmJob.isPending}
        onPress={() => void onConfirm()}
        testID={`pro-home-confirm-${job.id}`}
      />
    </Pressable>
  );
}

function ExpiringOfferRow({ offer }: { offer: OfferWithRequest }) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['professional', 'common']);
  const format = useFormatters();
  const category = useCategoryName(offer.request.categoryId) || t('common:category.unknown');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('professional:home.attention.expiringTitle')}, ${category}`}
      onPress={() => router.push(routes.offer(offer.id))}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <CategoryIcon categoryId={offer.request.categoryId} size="md" />
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {t('professional:home.attention.expiringTitle')}
        </AppText>
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          {t('professional:home.attention.expiringSubtitle', { category, price: format.currency(offer.price, offer.currency) })}
        </AppText>
        <ExpiryBadge expiresAt={offer.expiresAt} />
      </View>
      <Icon name="chevron-right" size={20} color="muted" flipInRTL />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.lg,
    minHeight: 72,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
}));
