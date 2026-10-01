import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Avatar, Skeleton, haptics } from '@/components/ui';
import { useFormatters, usePersonName } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { Conversation } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import { getConversationActivityAt, getConversationPreview, getCounterpart, getListTimeKind } from './chat-model';

interface ConversationRowProps {
  conversation: Conversation;
  currentUserId: string | null;
  now: Date;
  onPress: () => void;
  /** Hides the top divider (first row of the list). */
  first?: boolean;
}

const AVATAR_SIZE = 48;

/**
 * Conversation list item: counterpart avatar and name, last message (or "Chat closed" for a closed
 * chat without one), time and unread count.
 */
export function ConversationRow({ conversation, currentUserId, now, onPress, first = false }: ConversationRowProps) {
  const styles = useStyles();
  const { t } = useTranslation(['messaging', 'common']);
  const format = useFormatters();
  const personName = usePersonName();
  const counterpart = getCounterpart(conversation, currentUserId);
  const preview = getConversationPreview(conversation, currentUserId);
  const activityAt = getConversationActivityAt(conversation);
  const unread = conversation.unreadCount > 0;
  const name = counterpart ? personName(counterpart) : t('common:category.unknown');

  const timeKind = getListTimeKind(activityAt, now);
  const time =
    timeKind === 'time'
      ? format.time(activityAt)
      : timeKind === 'yesterday'
        ? t('common:time.yesterday')
        : format.date(activityAt, timeKind === 'weekday' ? 'weekdayShort' : 'dayMonth');

  const previewText = preview
    ? preview.text
    : conversation.isOpen
      ? t('messaging:conversations.noMessages')
      : t('messaging:conversations.closed');
  const textVariant = unread ? 'bodyStrong' : 'body';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        name,
        unread ? t('messaging:conversations.unread', { count: conversation.unreadCount }) : null,
        preview?.mine ? t('messaging:conversations.you', { text: isolateText(preview.text) }) : previewText,
        time,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={t('messaging:conversations.a11y.openHint')}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={`conversation-${conversation.id}`}
    >
      <Avatar name={name} uri={counterpart?.avatarUrl} size={AVATAR_SIZE} decorative style={styles.avatar} />
      <View style={[styles.texts, first ? null : styles.divider]}>
        <View style={styles.line}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
            {name}
          </AppText>
          <AppText variant="caption" color={unread ? 'primary' : 'muted'} tabular>
            {time}
          </AppText>
        </View>
        <View style={styles.line}>
          <View style={styles.preview}>
            {preview?.mine ? (
              // A separate "You:" keeps the message in its own direction: inside one RTL sentence a
              // truncated English message would lose its beginning instead of its end.
              <AppText variant={textVariant} color="muted" style={styles.noShrink}>
                {t('messaging:conversations.youPrefix')}
              </AppText>
            ) : null}
            <AppText variant={textVariant} color={unread ? 'default' : preview ? 'secondary' : 'muted'} numberOfLines={1} style={styles.flex}>
              {previewText}
            </AppText>
          </View>
          {unread ? (
            <View style={styles.count}>
              <AppText variant="tiny" color="onPrimary" tabular>
                {format.number(conversation.unreadCount)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ConversationRowSkeleton({ first = false }: { first?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Skeleton circle height={AVATAR_SIZE} style={styles.avatar} />
      <View style={[styles.texts, styles.skeletonTexts, first ? null : styles.divider]}>
        <Skeleton width="45%" height={14} />
        <Skeleton width="80%" height={12} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  avatar: {
    alignSelf: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
    paddingVertical: t.spacing.md + 2,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  preview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  noShrink: {
    flexShrink: 0,
  },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: t.spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primaryFill,
  },
}));
