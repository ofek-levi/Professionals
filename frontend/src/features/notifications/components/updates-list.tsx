import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, useNow, usePullToRefresh } from '@/components/ui';
import { useNotificationPresenter, useOpenNotification, useRefetchOnFocus, useUnreadNotificationsCount, useUpdateNotifications } from '@/hooks';
import { useSession } from '@/features/auth';
import { makeStyles, useTheme } from '@/theme';

import { NotificationDayGroupList, NotificationGroupSkeleton } from './notification-day-group';
import { groupNotificationsByDay } from './notification-list-model';

/**
 * Inbox "Updates": the signed-in user's notifications grouped by day (infinite list with
 * pull-to-refresh). Chat messages are left out by the server (they are under Messages), so every
 * page it loads is full and scrolling keeps loading older updates. Opening a notification marks it
 * read and navigates to its target.
 */
export function UpdatesList() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('notifications');
  const { role } = useSession();
  const now = useNow(60_000);
  const query = useUpdateNotifications();
  const unreadQuery = useUnreadNotificationsCount();
  const pull = usePullToRefresh(() => Promise.all([query.refetch(), unreadQuery.refetch()]));
  const openNotification = useOpenNotification();
  const present = useNotificationPresenter();
  useRefetchOnFocus(query.refetch);

  if (query.data === undefined) {
    return query.isError ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
    ) : (
      <View style={styles.skeletons}>
        <NotificationGroupSkeleton rows={3} />
        <NotificationGroupSkeleton rows={2} />
      </View>
    );
  }

  const groups = groupNotificationsByDay(query.data.items, now);

  return (
    <FlatList
      data={groups}
      keyExtractor={(group) => group.key}
      renderItem={({ item }) => (
        <NotificationDayGroupList group={item} now={now} present={present} onPressNotification={openNotification} />
      )}
      ItemSeparatorComponent={GroupSeparator}
      contentContainerStyle={[styles.content, groups.length === 0 ? styles.emptyContent : null]}
      ListEmptyComponent={
        <EmptyState
          compact
          icon="bell-outline"
          title={t('inbox.emptyUpdates')}
          description={role ? t(`inbox.emptyUpdatesDescription.${role}`) : undefined}
          testID="updates-empty"
        />
      }
      ListFooterComponent={
        query.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} style={styles.spinner} /> : null
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      showsVerticalScrollIndicator={false}
      testID="inbox-updates"
    />
  );
}

function GroupSeparator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((t) => ({
  content: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.xxxl,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  skeletons: {
    gap: t.spacing.xxl,
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.lg,
  },
  separator: {
    height: t.spacing.xl,
  },
  spinner: {
    marginVertical: t.spacing.lg,
  },
}));
