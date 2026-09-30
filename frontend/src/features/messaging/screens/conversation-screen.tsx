/**
 * `/conversations/:conversationId` – job chat for both parties: a one-line job context strip,
 * inverted message list with day separators and grouped bubbles, optimistic sending with retry
 * for failed messages, read receipts and a keyboard-safe composer. Opening the chat (and every new
 * incoming message while it is open) marks the conversation as read.
 */
import { Stack, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, EmptyState, ErrorState, KEYBOARD_DISMISS_MODE, Screen, Skeleton, useConfirm, useNow } from '@/components/ui';
import { useSession } from '@/features/auth';
import { canSendMessage } from '@/features/messaging/message-rules';
import {
  isPendingMessage,
  useConversation,
  useConversationMessages,
  useJob,
  useMarkConversationAsRead,
  useRefetchOnFocus,
  useRouteParam,
} from '@/hooks';
import { usePersonName } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { Conversation } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { ChatComposer } from '../components/chat-composer';
import { ChatDaySeparator } from '../components/chat-day-separator';
import {
  buildChatRows,
  getCounterpart,
  getLatestIncomingUnreadId,
  type ChatRow,
  type FailedMessage,
} from '../components/chat-model';
import { JobContextBanner, JobContextBannerSkeleton } from '../components/job-context-banner';
import { MessageBubble } from '../components/message-bubble';
import { useChatSender } from '../components/use-chat-sender';

export default function ConversationScreen() {
  const { t } = useTranslation(['messaging', 'common']);
  const conversationId = useRouteParam('conversationId');
  const query = useConversation(conversationId);
  useRefetchOnFocus(query.refetch);

  if (!conversationId || query.data === undefined) {
    return (
      <Screen edges={['left', 'right', 'bottom']} testID="chat-screen">
        {!conversationId ? (
          <EmptyState icon="chat-remove-outline" title={t('messaging:chat.notFoundTitle')} description={t('messaging:chat.notFoundDescription')} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isRefetching} />
        ) : (
          <ChatSkeleton />
        )}
      </Screen>
    );
  }

  return <ChatView conversation={query.data} />;
}

function ChatView({ conversation }: { conversation: Conversation }) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const confirm = useConfirm();
  const { t } = useTranslation(['messaging', 'common']);
  const { userId } = useSession();
  const now = useNow(60_000);
  const personName = usePersonName();
  const [draft, setDraft] = useState('');

  const messagesQuery = useConversationMessages(conversation.id);
  const jobQuery = useJob(conversation.jobId);
  const markRead = useMarkConversationAsRead();
  const sender = useChatSender(conversation.id);
  useRefetchOnFocus(messagesQuery.refetch);

  const counterpart = getCounterpart(conversation, userId);
  const counterpartName = counterpart ? personName(counterpart) : t('common:screens.conversation');
  const isOpen = canSendMessage(conversation);
  const messages = messagesQuery.data?.items;
  const rows = messages
    ? buildChatRows({ messages, failed: sender.failed, currentUserId: userId, now, isPending: isPendingMessage })
    : [];

  // Mark as read once the messages are loaded, then again whenever a new incoming message arrives.
  const latestIncomingUnreadId = messages ? getLatestIncomingUnreadId(messages, userId) : null;
  const messagesLoaded = messages !== undefined;
  const lastMarkedRef = useRef<string | null | undefined>(undefined);
  const markConversationRead = useEffectEvent(() => markRead.mutate(conversation.id));
  useEffect(() => {
    if (!messagesLoaded) return;
    const alreadyMarked = lastMarkedRef.current !== undefined;
    if (alreadyMarked && (latestIncomingUnreadId === null || latestIncomingUnreadId === lastMarkedRef.current)) return;
    lastMarkedRef.current = latestIncomingUnreadId;
    markConversationRead();
  }, [messagesLoaded, latestIncomingUnreadId]);

  const openJob = () => router.push(routes.job(conversation.jobId));
  const discardFailed = async (message: FailedMessage) => {
    const confirmed = await confirm({
      title: t('messaging:chat.discardTitle'),
      message: t('messaging:chat.discardMessage'),
      confirmLabel: t('common:actions.delete'),
      destructive: true,
    });
    if (confirmed) sender.discard(message);
  };

  const renderRow = ({ item }: { item: ChatRow }) =>
    item.kind === 'day' ? (
      <ChatDaySeparator row={item} now={now} />
    ) : (
      <MessageBubble row={item} counterpartName={counterpartName} onRetry={sender.retry} onDiscard={(message) => void discardFailed(message)} />
    );

  const intro = (
    <View style={styles.intro}>
      <Avatar name={counterpartName} uri={counterpart?.avatarUrl} size="lg" decorative />
      <AppText variant="subheading" align="center">
        {t('messaging:chat.beginningTitle', { name: isolateText(counterpartName) })}
      </AppText>
      <AppText variant="caption" color="secondary" align="center" style={styles.introText}>
        {t('messaging:chat.beginningDescription')}
      </AppText>
    </View>
  );

  let body;
  if (messagesQuery.data === undefined) {
    body = messagesQuery.isError ? (
      <ErrorState error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} retrying={messagesQuery.isRefetching} compact />
    ) : (
      <View style={styles.messagesSkeleton}>
        <MessagesSkeleton />
      </View>
    );
  } else if (rows.length === 0) {
    body = <View style={styles.emptyChat}>{intro}</View>;
  } else {
    body = (
      <FlatList
        inverted
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) void messagesQuery.fetchNextPage();
        }}
        ListFooterComponent={
          messagesQuery.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} style={styles.olderSpinner} /> : null
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={KEYBOARD_DISMISS_MODE}
        showsVerticalScrollIndicator={false}
        testID="chat-messages"
      />
    );
  }

  const footer = (
    <View style={styles.footer}>
      {isOpen ? null : (
        <AppText variant="caption" color="muted" align="center" testID="chat-closed">
          {counterpart?.accountDeleted ? t('messaging:chat.closedAccountDeleted') : t('messaging:chat.closedMessage')}
        </AppText>
      )}
      <ChatComposer value={draft} onChangeText={setDraft} onSend={sender.send} disabled={!isOpen} />
    </View>
  );

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      scroll={false}
      padded={false}
      footer={footer}
      header={
        jobQuery.data ? (
          <JobContextBanner job={jobQuery.data} onPress={openJob} />
        ) : jobQuery.isPending ? (
          <JobContextBannerSkeleton />
        ) : null
      }
      maxContentWidth={false}
      testID="chat-screen"
    >
      <Stack.Screen options={{ title: counterpartName }} />
      <View style={styles.messagesArea}>{body}</View>
    </Screen>
  );
}

function MessagesSkeleton() {
  const styles = useStyles();
  const widths = ['62%', '48%', '70%', '40%'] as const;
  return (
    <View style={styles.skeletonList}>
      {widths.map((width, index) => (
        <View key={width} style={index % 2 === 0 ? styles.skeletonStart : styles.skeletonEnd}>
          <Skeleton width={width} height={index % 2 === 0 ? 52 : 40} radius={18} />
        </View>
      ))}
    </View>
  );
}

function ChatSkeleton() {
  return (
    <>
      <JobContextBannerSkeleton />
      <MessagesSkeleton />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  messagesArea: {
    flex: 1,
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
  },
  listContent: {
    paddingHorizontal: t.spacing.screen,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.md,
  },
  footer: {
    gap: t.spacing.sm,
  },
  intro: {
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xxl,
    paddingHorizontal: t.spacing.xl,
  },
  introText: {
    maxWidth: 300,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
  },
  olderSpinner: {
    marginVertical: t.spacing.lg,
  },
  messagesSkeleton: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.lg,
  },
  skeletonList: {
    gap: t.spacing.md,
    paddingTop: t.spacing.lg,
  },
  skeletonStart: {
    alignItems: 'flex-start',
  },
  skeletonEnd: {
    alignItems: 'flex-end',
  },
}));
