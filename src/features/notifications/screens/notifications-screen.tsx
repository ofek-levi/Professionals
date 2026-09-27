/**
 * Notifications tab (both roles): unread / all filter, day-grouped infinite list, mark-all-as-read,
 * pull-to-refresh. Opening a notification marks it read and navigates to its target; the tab badge
 * follows the unread-count query automatically.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Screen,
  ScreenHeader,
  useErrorText,
  useNow,
  useToast,
} from '@/components/ui';
import { useSession } from '@/features/auth';
import {
  useMarkAllNotificationsAsRead,
  useNotificationPresenter,
  useNotifications,
  useOpenNotification,
  useRefetchOnFocus,
  useUnreadNotificationsCount,
} from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import { NotificationDayGroupCard, NotificationGroupSkeleton } from '../components/notification-day-group';
import { groupNotificationsByDay } from '../components/notification-list-model';

type NotificationFilter = 'all' | 'unread';

export default function NotificationsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['notifications', 'common']);
  const { role } = useSession();
  const toast = useToast();
  const errorText = useErrorText();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const query = useNotifications(filter === 'unread' ? { unreadOnly: true } : {});
  const unreadQuery = useUnreadNotificationsCount();
  const markAll = useMarkAllNotificationsAsRead();
  const openNotification = useOpenNotification();
  const present = useNotificationPresenter();
  useRefetchOnFocus(query.refetch);

  const unreadCount = unreadQuery.data ?? 0;
  const groups = query.data ? groupNotificationsByDay(query.data.items, now) : [];

  const markAllAsRead = () => {
    markAll.mutate(undefined, {
      onSuccess: () => toast.show({ title: t('notifications:markAllReadDone'), tone: 'success', icon: 'check-all' }),
      onError: (error) => {
        const { title, description } = errorText(error);
        toast.show({ title, message: description, tone: 'danger' });
      },
    });
  };

  const refresh = () => {
    void query.refetch();
    void unreadQuery.refetch();
  };

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title={t('notifications:title')}
        subtitle={unreadCount > 0 ? t('notifications:unreadCount', { count: unreadCount }) : t('notifications:allRead')}
        actions={
          <Button
            label={t('notifications:markAllReadShort')}
            leftIcon="check-all"
            size="sm"
            variant="secondary"
            shape="pill"
            disabled={unreadCount === 0 || markAll.isPending}
            loading={markAll.isPending}
            onPress={markAllAsRead}
            accessibilityLabel={t('notifications:markAllRead')}
            testID="notifications-mark-all"
          />
        }
      />
      <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel={t('notifications:a11y.filters')}>
        <Chip
          label={t('notifications:filters.all')}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
          testID="notifications-filter-all"
        />
        <Chip
          label={t('notifications:filters.unread')}
          selected={filter === 'unread'}
          count={unreadCount > 0 ? unreadCount : undefined}
          onPress={() => setFilter('unread')}
          testID="notifications-filter-unread"
        />
      </View>
    </View>
  );

  const emptyState =
    filter === 'unread' ? (
      <EmptyState
        icon="check-all"
        tone="success"
        title={t('notifications:empty.unreadTitle')}
        description={t('notifications:empty.unreadDescription')}
        actionLabel={t('notifications:empty.showAll')}
        onAction={() => setFilter('all')}
      />
    ) : (
      <EmptyState
        icon="bell-check-outline"
        title={t('notifications:empty.title')}
        description={t('notifications:empty.description')}
        actionLabel={role === 'professional' ? t('notifications:empty.professionalAction') : t('notifications:empty.customerAction')}
        actionIcon={role === 'professional' ? 'map-search-outline' : 'plus'}
        onAction={() => router.push(role === 'professional' ? routes.professional.explore : routes.newRequest())}
      />
    );

  let body;
  if (query.data === undefined) {
    body = query.isError ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
    ) : (
      <View style={styles.skeletons}>
        <NotificationGroupSkeleton rows={3} />
        <NotificationGroupSkeleton rows={2} />
      </View>
    );
  } else {
    body = (
      <FlatList
        data={groups}
        keyExtractor={(group) => group.key}
        renderItem={({ item }) => (
          <NotificationDayGroupCard group={item} now={now} present={present} onPressNotification={openNotification} />
        )}
        ItemSeparatorComponent={GroupSeparator}
        contentContainerStyle={[styles.listContent, groups.length === 0 ? styles.emptyContent : null]}
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} style={styles.footerSpinner} /> : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        testID="notifications-list"
      />
    );
  }

  return (
    <Screen scroll={false} padded={false} header={header} testID="notifications-screen">
      {body}
    </Screen>
  );
}

function GroupSeparator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingHorizontal: t.spacing.screen,
  },
  filters: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    paddingBottom: t.spacing.md,
  },
  skeletons: {
    gap: t.spacing.xl,
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.xs,
  },
  listContent: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.xs,
    paddingBottom: t.spacing.xxxl,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: t.spacing.xl,
  },
  footerSpinner: {
    marginVertical: t.spacing.lg,
  },
}));
