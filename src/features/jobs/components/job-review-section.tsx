import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReviewCard } from '@/components/professionals';
import { AppText, Card, Icon, InlineAlert, SectionHeader } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';
import type { JobDetails, UserRole } from '@/types/domain';

import { isolateText } from './bidi';

export interface JobReviewSectionProps {
  job: JobDetails;
  role: UserRole;
  /** The customer may review now (from `getJobActions`). */
  canReview: boolean;
  counterpartName: string;
  onLeaveReview: () => void;
}

/** Submitted review, a review prompt for the customer, or a "no review yet" note for the professional. */
export function JobReviewSection({ job, role, canReview, counterpartName, onLeaveReview }: JobReviewSectionProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('jobs');

  if (job.review) {
    return (
      <View>
        <SectionHeader
          title={role === 'customer' ? t('details.review.customerTitle') : t('details.review.professionalTitle')}
          icon="star-outline"
        />
        <ReviewCard review={job.review} variant="elevated" />
      </View>
    );
  }

  if (canReview) {
    return (
      <Card
        padding="lg"
        style={styles.prompt}
        onPress={onLeaveReview}
        accessibilityLabel={`${t('details.review.promptTitle', { name: counterpartName })}, ${t('actions.review')}`}
        testID="job-review-prompt"
      >
        <View style={styles.stars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[1, 2, 3, 4, 5].map((value) => (
            <Icon key={value} name="star" size={28} color={theme.colors.star} />
          ))}
        </View>
        <AppText variant="heading" align="center">
          {t('details.review.promptTitle', { name: isolateText(counterpartName) })}
        </AppText>
        <AppText variant="caption" color="secondary" align="center" style={styles.promptText}>
          {t('details.review.promptDescription')}
        </AppText>
        <View style={styles.promptLink}>
          <AppText variant="bodyStrong" color="primary">
            {t('actions.review')}
          </AppText>
          <Icon name="arrow-right" size={18} color="primary" flipInRTL />
        </View>
      </Card>
    );
  }

  if (role === 'professional' && job.status === 'completed') {
    return <InlineAlert tone="neutral" icon="star-outline" message={t('details.review.pendingProfessional')} />;
  }

  return null;
}

const useStyles = makeStyles((t) => ({
  prompt: {
    alignItems: 'center',
    gap: t.spacing.sm,
    borderWidth: 1,
    borderColor: t.colors.tones.warning.bg,
  },
  stars: {
    flexDirection: 'row',
    gap: t.spacing.xs,
    marginBottom: t.spacing.xs,
  },
  promptText: {
    maxWidth: 320,
  },
  promptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    marginTop: t.spacing.xs,
  },
}));
