import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, useNow, usePullToRefresh } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useConversations, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import { ConversationRow, ConversationRowSkeleton } from './conversation-row';

/** Inbox "Messages": the signed-in user's job chats, most recent activity first (more on scroll). */
export function ConversationList() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('messaging');
  const { userId, role } = useSession();
  const now = useNow(60_000);
  const query = useConversations();
  const pull = usePullToRefresh(() => query.refetch());
  useRefetchOnFocus(query.refetch);

  if (query.data === undefined) {
    return query.isError ? (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
    ) : (
      <View style={styles.skeletons}>
        {[0, 1, 2].map((index) => (
          <ConversationRowSkeleton key={index} first={index === 0} />
        ))}
      </View>
    );
  }

  const conversations = query.data.items;

  return (
    <FlatList
      data={conversations}
      keyExtractor={(conversation) => conversation.id}
      renderItem={({ item, index }) => (
        <ConversationRow
          conversation={item}
          currentUserId={userId}
          now={now}
          first={index === 0}
          onPress={() => router.push(routes.conversation(item.id))}
        />
      )}
      contentContainerStyle={[styles.content, conversations.length === 0 ? styles.emptyContent : null]}
      ListEmptyComponent={
        <EmptyState
          compact
          icon="message-text-outline"
          title={t('conversations.empty')}
          description={role ? t(`conversations.emptyDescription.${role}`) : undefined}
          testID="conversations-empty"
        />
      }
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} style={styles.footerSpinner} /> : null}
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
      testID="inbox-messages"
    />
  );
}

const useStyles = makeStyles((t) => ({
  content: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.xxxl,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  skeletons: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.sm,
  },
  footerSpinner: {
    paddingVertical: t.spacing.lg,
  },
}));
