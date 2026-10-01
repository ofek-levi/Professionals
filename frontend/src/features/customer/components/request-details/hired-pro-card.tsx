import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { openContactLink, phoneUrl } from '@/components/professionals';
import {
  AppText,
  Avatar,
  BUTTON_SIZE_TOKENS,
  Button,
  Card,
  Divider,
  ErrorState,
  Icon,
  IconButton,
  PriceText,
  RatingStars,
  SkeletonCard,
} from '@/components/ui';
import { getJobActions } from '@/features/jobs/job-status-machine';
import { useProfessionalProfile } from '@/hooks';
import { useFormatters, usePersonName } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { JobDetails } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

interface HiredProCardProps {
  job: JobDetails | undefined;
  error: unknown;
  loading: boolean;
  onRetry: () => void;
}

/**
 * After an offer was accepted: the hired pro, the appointment and price, "View job", a call button
 * (their phone comes with their profile while the job is not cancelled) and a message button
 * while their chat is open. Once the job is done and not reviewed yet, "Leave a review" takes the
 * lead instead. A pro who deleted their account shows as "Deleted user", without a profile to open
 * or a chat.
 */
export function HiredProCard({ job, error, loading, onRetry }: HiredProCardProps) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['customer', 'common', 'jobs']);
  const format = useFormatters();
  const personName = usePersonName();
  const hiredProfessionalId = job && job.status !== 'cancelled' && !job.professional.accountDeleted ? job.professional.id : null;
  const phone = useProfessionalProfile(hiredProfessionalId).data?.contact?.phone ?? null;

  if (!job) {
    if (loading) return <SkeletonCard lines={3} />;
    return <ErrorState compact error={error} onRetry={onRetry} />;
  }

  const pro = job.professional;
  const name = personName(pro);
  const actions = getJobActions(job, 'customer');
  const completed = job.status === 'completed' && job.completedAt;

  return (
    <Card padding="none" style={styles.card} testID="hired-pro">
      <Pressable
        accessibilityRole={pro.accountDeleted ? undefined : 'button'}
        accessibilityLabel={name}
        disabled={pro.accountDeleted}
        onPress={() => router.push(routes.professionalProfile(pro.id))}
        style={({ pressed }) => [styles.proRow, pressed ? styles.pressed : null]}
        testID="hired-pro-profile"
      >
        <Avatar name={name} uri={pro.avatarUrl} size="md" decorative />
        <View style={styles.who}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {name}
          </AppText>
          <RatingStars value={pro.averageRating} count={pro.reviewCount} variant="compact" size={13} textVariant="caption" />
        </View>
        {pro.accountDeleted ? null : <Icon name="chevron-right" size={20} color="muted" flipInRTL />}
      </Pressable>

      <Divider />

      <View style={styles.facts}>
        <View style={[styles.fact, styles.when]}>
          <AppText variant="caption" color="muted">
            {completed ? t('customer:details.hired.completed') : t('customer:details.hired.appointment')}
          </AppText>
          <AppText variant="bodyStrong">{format.dateTime(completed || job.scheduledStartAt)}</AppText>
        </View>
        <View style={styles.fact}>
          <AppText variant="caption" color="muted">
            {t('customer:details.hired.price')}
          </AppText>
          <PriceText amount={job.agreedPrice} currency={job.currency} variant="bodyStrong" />
        </View>
      </View>

      <View style={styles.buttons}>
        {actions.canReview ? (
          <Button
            label={t('jobs:actions.review')}
            size="md"
            onPress={() => router.push(routes.reviewJob(job.id))}
            style={styles.flex}
            testID="hired-pro-review"
          />
        ) : (
          <Button
            label={t('customer:details.hired.viewJob')}
            size="md"
            onPress={() => router.push(routes.job(job.id))}
            style={styles.flex}
            testID="hired-pro-view-job"
          />
        )}
        {hiredProfessionalId && phone ? (
          <IconButton
            icon="phone-outline"
            variant="soft"
            size="lg"
            accessibilityLabel={t('common:contact.callA11y', { phone })}
            onPress={() => openContactLink(phoneUrl(phone))}
            style={styles.message}
            testID="hired-pro-call"
          />
        ) : null}
        {actions.canMessage ? (
          <IconButton
            icon="message-text-outline"
            variant="soft"
            size="lg"
            accessibilityLabel={t('customer:details.hired.message', { name: isolateText(name) })}
            onPress={() => router.push(routes.conversation(job.conversationId))}
            style={styles.message}
            testID="hired-pro-message"
          />
        ) : null}
      </View>
      {actions.canReview ? (
        <Button
          label={t('customer:details.hired.viewJob')}
          variant="ghost"
          size="sm"
          onPress={() => router.push(routes.job(job.id))}
          style={styles.secondaryLink}
          testID="hired-pro-view-job"
        />
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.lg,
  },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    minHeight: 68,
  },
  pressed: {
    opacity: 0.6,
  },
  flex: {
    flex: 1,
  },
  who: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  facts: {
    flexDirection: 'row',
    gap: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  fact: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  when: {
    flex: 2,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  secondaryLink: {
    alignSelf: 'center',
    marginTop: t.spacing.sm,
    marginBottom: -t.spacing.xs,
  },
  message: {
    width: BUTTON_SIZE_TOKENS.md.height,
    height: BUTTON_SIZE_TOKENS.md.height,
    borderRadius: BUTTON_SIZE_TOKENS.md.radius,
  },
}));
