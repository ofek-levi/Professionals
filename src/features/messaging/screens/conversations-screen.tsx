/**
 * `/conversations` – the signed-in user's job chats, most recent activity first, with the
 * counterpart, job category, last message preview, unread badge and closed state.
 */
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, ErrorState, Screen, useNow } from '@/components/ui';
import { useSession } from '@/features/auth';
import { useConversations, useJobs, useRefetchOnFocus } from '@/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { JobSummary } from '@/types/domain';

import { ConversationRow, ConversationRowSkeleton } from '../components/conversation-row';

export default function ConversationsScreen() {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['messaging', 'common']);
  const { userId, role } = useSession();
  const now = useNow(60_000);
  const query = useConversations();
  const jobsQuery = useJobs('all');
  useRefetchOnFocus(query.refetch);

  const jobsById = new Map<string, JobSummary>((jobsQuery.data ?? []).map((job) => [job.id, job]));
  const refresh = () => {
    void query.refetch();
    void jobsQuery.refetch();
  };

  if (query.data === undefined) {
    return (
      <Screen edges={['left', 'right', 'bottom']} gap="md" testID="conversations-screen">
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <>
            <ConversationRowSkeleton />
            <ConversationRowSkeleton />
            <ConversationRowSkeleton />
          </>
        )}
      </Screen>
    );
  }

  const isProfessional = role === 'professional';
  const conversations = query.data;

  return (
    <Screen edges={['left', 'right']} scroll={false} padded={false} testID="conversations-screen">
      <FlatList
        data={conversations}
        keyExtractor={(conversation) => conversation.id}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            currentUserId={userId}
            job={jobsById.get(item.jobId)}
            now={now}
            onPress={() => router.push(routes.conversation(item.id))}
          />
        )}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[styles.listContent, conversations.length === 0 ? styles.emptyContent : null]}
        ListEmptyComponent={
          <EmptyState
            icon="message-text-outline"
            title={t('messaging:conversations.empty.title')}
            description={
              isProfessional
                ? t('messaging:conversations.empty.professionalDescription')
                : t('messaging:conversations.empty.customerDescription')
            }
            actionLabel={
              isProfessional ? t('messaging:conversations.empty.professionalAction') : t('messaging:conversations.empty.customerAction')
            }
            actionIcon={isProfessional ? 'map-search-outline' : 'clipboard-text-outline'}
            onAction={() => router.push(isProfessional ? routes.professional.explore : routes.customer.requests)}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        testID="conversations-list"
      />
    </Screen>
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((t) => ({
  listContent: {
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.huge,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: t.spacing.md,
  },
}));
