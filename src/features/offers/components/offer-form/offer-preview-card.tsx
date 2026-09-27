/** Live "How the customer will see your offer" preview. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ProfessionalSummaryCard } from '@/components/professionals';
import { AppText, Icon } from '@/components/ui';
import { makeStyles } from '@/theme';
import type { CategoryId, CurrencyCode, OwnProfessionalProfile, ProfessionalSummary } from '@/types/domain';

import { OfferTerms } from '../offer-terms';

export interface OfferPreviewCardProps {
  profile: OwnProfessionalProfile;
  categoryId: CategoryId;
  distanceKm: number;
  price: number | null;
  currency: CurrencyCode;
  proposedStartAt: string | null;
  estimatedDurationMinutes: number | null;
  message: string | null;
}

export function toProfessionalSummary(profile: OwnProfessionalProfile): ProfessionalSummary {
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    headline: profile.headline,
    categoryIds: profile.categoryIds,
    yearsOfExperience: profile.yearsOfExperience,
    averageRating: profile.stats.averageRating,
    reviewCount: profile.stats.reviewCount,
    completedJobsCount: profile.stats.completedJobsCount,
    isVerified: profile.isVerified,
    city: profile.serviceArea.label,
  };
}

export function OfferPreviewCard({ profile, categoryId, distanceKm, ...terms }: OfferPreviewCardProps) {
  const styles = useStyles();
  const { t } = useTranslation('offers');
  return (
    <View style={styles.container} testID="offer-form-preview">
      <View style={styles.titleRow}>
        <Icon name="eye-outline" size={18} color="secondary" />
        <AppText variant="subheading" style={styles.flex}>
          {t('form.preview.title')}
        </AppText>
      </View>
      <AppText variant="caption" color="muted">
        {t('form.preview.description')}
      </AppText>
      <ProfessionalSummaryCard
        professional={toProfessionalSummary(profile)}
        highlightCategoryIds={[categoryId]}
        maxCategories={2}
        distanceKm={distanceKm}
        footer={<OfferTerms {...terms} size="md" />}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
  },
}));
