/**
 * `/professionals/:professionalId` – public professional profile: identity, credentials, rating,
 * about, service area, weekly availability, business details, starting price and recent reviews.
 */
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { RatingSummary, ReviewCard } from '@/components/professionals';
import { Button, EmptyState, ErrorState, Screen, SkeletonCard } from '@/components/ui';
import { useProfessionalProfile, useProfessionalReviews, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { ProfileHeader, ProfileHeaderSkeleton } from '../components/public-profile/profile-header';
import {
  AboutSection,
  AvailabilitySection,
  BusinessSection,
  ProfileSection,
  ProfileStats,
  ServiceAreaSection,
  StartingPriceCard,
} from '../components/public-profile/profile-sections';

const RECENT_REVIEWS = 3;

export default function ProfessionalProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['profile', 'common']);
  const professionalId = useRouteParam('professionalId');
  const profileQuery = useProfessionalProfile(professionalId);
  const reviewsQuery = useProfessionalReviews(professionalId, { limit: RECENT_REVIEWS });
  useRefetchOnFocus(profileQuery.refetch);

  const profile = profileQuery.data;

  const refresh = () => {
    void profileQuery.refetch();
    void reviewsQuery.refetch();
  };

  if (!profile) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="xl" testID="professional-profile">
        {profileQuery.isError || !professionalId ? (
          <ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} retrying={profileQuery.isRefetching} />
        ) : (
          <>
            <ProfileHeaderSkeleton />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={4} />
          </>
        )}
      </Screen>
    );
  }

  const reviews = reviewsQuery.data?.items.slice(0, RECENT_REVIEWS) ?? [];
  const breakdown = reviewsQuery.data?.breakdown ?? null;
  const reviewCount = breakdown?.reviewCount ?? profile.stats.reviewCount;

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      gap="xl"
      refreshing={profileQuery.isRefetching}
      onRefresh={refresh}
      testID="professional-profile"
    >
      <Stack.Screen options={{ title: profile.displayName }} />
      <ProfileHeader profile={profile} />
      <ProfileStats profile={profile} />
      <StartingPriceCard profile={profile} />
      <AboutSection profile={profile} />

      <ProfileSection title={t('profile:public.reviews')} icon="star-outline" testID="profile-reviews">
        {breakdown ? <RatingSummary breakdown={breakdown} /> : null}
        {reviewsQuery.isPending ? (
          <SkeletonCard lines={2} />
        ) : reviewsQuery.isError ? (
          <ErrorState compact error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} />
        ) : reviews.length === 0 ? (
          <EmptyState compact icon="star-outline" title={t('common:rating.noReviews')} description={t('profile:public.noReviewsDescription')} />
        ) : (
          <View style={styles.reviews}>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} showCategory />
            ))}
          </View>
        )}
        {reviewCount > 0 ? (
          <Button
            label={t('profile:public.seeAllReviews', { count: reviewCount })}
            variant="secondary"
            rightIcon="chevron-right"
            flipIconsInRTL
            fullWidth
            onPress={() => router.push(routes.professionalReviews(profile.id))}
            testID="profile-see-all-reviews"
          />
        ) : null}
      </ProfileSection>

      <ServiceAreaSection profile={profile} />
      <AvailabilitySection profile={profile} />
      <BusinessSection profile={profile} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  reviews: {
    gap: t.spacing.md,
  },
}));
