/** Customer Profile tab: identity header and the account menu. */
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ErrorState, Screen, ScreenHeader } from '@/components/ui';
import { AccountHeader, AccountHeaderSkeleton, AccountMenu } from '@/features/settings/components/account-menu';
import { useCustomerProfile, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const query = useCustomerProfile();
  useRefetchOnFocus(query.refetch);
  const user = query.data?.user;

  return (
    <Screen gap="xxl" refreshing={query.isRefetching} onRefresh={() => void query.refetch()} testID="customer-profile">
      <ScreenHeader title={t('common:tabs.profile')} />
      {user ? (
        <AccountHeader
          name={`${user.firstName} ${user.lastName}`.trim() || user.displayName}
          avatarUrl={user.avatarUrl}
          subtitle={user.email}
        />
      ) : query.isError ? (
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : (
        <AccountHeaderSkeleton />
      )}
      <AccountMenu items={[{ key: 'edit', title: t('settings:account.editProfile'), onPress: () => router.push(routes.editProfile) }]} />
    </Screen>
  );
}
