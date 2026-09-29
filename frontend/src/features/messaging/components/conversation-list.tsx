import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, useNow } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useConversations, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';

import { ConversationRow, ConversationRowSkeleton } from './conversation-row';

/** Inbox "Messages": the signed-in user's job chats, most recent activity first. */
export function ConversationList() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('messaging');
  const { userId } = useSession();
  const now = useNow(60_000);
  const query = useConversations();
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

  const conversations = query.data;

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
      ListEmptyComponent={<EmptyState compact icon="message-text-outline" title={t('conversations.empty')} />}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
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
}));
