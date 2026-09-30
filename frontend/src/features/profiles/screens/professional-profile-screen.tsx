/**
 * `/professionals/:professionalId` – public professional profile: identity and rating, about,
 * services, the latest reviews, the service area and compact working hours.
 */
import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReviewCard } from '@/components/professionals';
import { AppText, ErrorState, Screen, SkeletonCard } from '@/components/ui';
import { useProfessionalProfile, useProfessionalReviews, useRefetchOnFocus, useRouteParam } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { ProfileHeader, ProfileHeaderSkeleton } from '../components/public-profile/profile-header';
import { AboutSection, AreaAndHoursSection, ProfileSection, ServicesSection } from '../components/public-profile/profile-sections';

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

  if (!profile) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="xxl" testID="professional-profile">
        {profileQuery.isError || !professionalId ? (
          <ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} retrying={profileQuery.isRefetching} />
        ) : (
          <>
            <ProfileHeaderSkeleton />
            <SkeletonCard lines={3} />
          </>
        )}
      </Screen>
    );
  }

  const reviews = reviewsQuery.data?.items.slice(0, RECENT_REVIEWS) ?? [];
  const reviewCount = reviewsQuery.data?.breakdown?.reviewCount ?? profile.stats.reviewCount;

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      gap="xxxl"
      onRefresh={() => Promise.all([profileQuery.refetch(), reviewsQuery.refetch()])}
      testID="professional-profile"
    >
      {/* The large name below is the title; the header stays empty (the name still names the page). */}
      <Stack.Screen options={{ title: profile.displayName, headerTitle: '' }} />
      <ProfileHeader profile={profile} />
      <AboutSection profile={profile} />
      <ServicesSection profile={profile} />

      <ProfileSection
        title={t('profile:public.reviews')}
        actionLabel={reviewCount > reviews.length ? t('common:actions.seeAll') : undefined}
        onAction={() => router.push(routes.professionalReviews(profile.id))}
        testID="profile-reviews"
      >
        {reviewsQuery.isPending ? (
          <SkeletonCard lines={2} />
        ) : reviewsQuery.isError ? (
          <ErrorState compact error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} />
        ) : reviews.length === 0 ? (
          <AppText variant="body" color="muted">
            {t('common:rating.noReviews')}
          </AppText>
        ) : (
          <View style={styles.reviews}>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} showCategory />
            ))}
          </View>
        )}
      </ProfileSection>

      <AreaAndHoursSection profile={profile} />
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  reviews: {
    gap: t.spacing.md,
  },
}));
