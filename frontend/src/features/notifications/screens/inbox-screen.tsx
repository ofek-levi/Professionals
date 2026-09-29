/**
 * Inbox tab (both roles): segmented "Updates | Messages" driven by the `?tab=` route param.
 * Updates = notifications grouped by day with a quiet "Mark all read" action; Messages = the
 * job chats. The tab badge follows the unread counts automatically.
 */
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Screen, ScreenHeader, SegmentedControl, useErrorToast, type SegmentedOption } from '@/components/ui';
import { ConversationList } from '@/features/messaging/components/conversation-list';
import { useMarkAllNotificationsAsRead, useRouteParam } from '@/hooks';
import { parseInboxTab, TAB_PARAM, type InboxTab } from '@/lib/routes';
import { makeStyles } from '@/theme';

import { UpdatesList } from '../components/updates-list';
import { useInboxCounts } from '../inbox-counts';

export default function InboxScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation('notifications');
  const showError = useErrorToast();
  const tab = parseInboxTab(useRouteParam(TAB_PARAM));
  // Same numbers as the tab badge (badge = updates + messages).
  const { updates: unreadUpdates, messages: unreadMessages } = useInboxCounts();
  const markAll = useMarkAllNotificationsAsRead();

  const options: SegmentedOption<InboxTab>[] = [
    { value: 'updates', label: t('inbox.tabs.updates'), count: unreadUpdates },
    { value: 'messages', label: t('inbox.tabs.messages'), count: unreadMessages },
  ];

  const showMarkAll = tab === 'updates' && unreadUpdates > 0;

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title={t('inbox.title')}
        style={styles.title}
        actions={
          showMarkAll ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('markAllRead')}
              disabled={markAll.isPending}
              hitSlop={12}
              onPress={() => markAll.mutate(undefined, { onError: (error) => showError(error) })}
              style={({ pressed }) => [styles.markAll, pressed || markAll.isPending ? styles.pressed : null]}
              testID="inbox-mark-all"
            >
              <AppText variant="captionStrong" color="primary">
                {t('markAllReadShort')}
              </AppText>
            </Pressable>
          ) : null
        }
      />
      <SegmentedControl
        options={options}
        value={tab}
        onChange={(next) => router.setParams({ [TAB_PARAM]: next })}
        testID="inbox-tabs"
      />
    </View>
  );

  return (
    <Screen scroll={false} padded={false} header={header} testID="inbox-screen">
      {tab === 'updates' ? <UpdatesList /> : <ConversationList />}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  header: {
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.xs,
  },
  title: {
    alignItems: 'center',
  },
  markAll: {
    minHeight: 32,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
}));
