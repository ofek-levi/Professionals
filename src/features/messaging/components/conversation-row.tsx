import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { AppText, Avatar, Badge, Card, Skeleton } from '@/components/ui';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import type { Conversation, JobSummary } from '@/types/domain';

import { getConversationActivityAt, getConversationPreview, getCounterpart, getListTimeKind, isolateText } from './chat-model';

export interface ConversationRowProps {
  conversation: Conversation;
  currentUserId: string | null;
  /** The conversation's job (category), when loaded. */
  job: Pick<JobSummary, 'categoryId'> | undefined;
  now: Date;
  onPress: () => void;
}

/** Conversation list item: counterpart, job category, last message preview, time and unread badge. */
export function ConversationRow({ conversation, currentUserId, job, now, onPress }: ConversationRowProps) {
  const styles = useStyles();
  const { t } = useTranslation(['messaging', 'common']);
  const format = useFormatters();
  const categoryName = useCategoryName(job?.categoryId) || t('common:category.unknown');
  const counterpart = getCounterpart(conversation, currentUserId);
  const preview = getConversationPreview(conversation, currentUserId);
  const activityAt = getConversationActivityAt(conversation);
  const unread = conversation.unreadCount > 0;
  const closed = !conversation.isOpen;
  const name = counterpart?.displayName ?? t('common:category.unknown');
  const role = counterpart ? t(`common:roles.${counterpart.role}`) : '';

  const timeKind = getListTimeKind(activityAt, now);
  const time =
    timeKind === 'time'
      ? format.time(activityAt)
      : timeKind === 'yesterday'
        ? t('common:time.yesterday')
        : format.date(activityAt, timeKind === 'weekday' ? 'weekdayShort' : 'dayMonth');

  const previewText = preview
    ? preview.mine
      ? t('messaging:conversations.you', { text: isolateText(preview.text) })
      : preview.text
    : t('messaging:conversations.noMessages');

  return (
    <Card
      onPress={onPress}
      padding="md"
      accessibilityLabel={[
        name,
        role,
        categoryName,
        closed ? t('messaging:conversations.closed') : null,
        unread ? t('messaging:conversations.unread', { count: conversation.unreadCount }) : null,
        previewText,
        time,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={t('messaging:conversations.a11y.openHint')}
      testID={`conversation-${conversation.id}`}
    >
      <View style={styles.row}>
        <Avatar name={name} uri={counterpart?.avatarUrl} size="md" decorative />
        <View style={styles.texts}>
          <View style={styles.topLine}>
            <AppText variant={unread ? 'subheading' : 'bodyStrong'} numberOfLines={1} style={styles.name}>
              {name}
            </AppText>
            <AppText variant="caption" color={unread ? 'primary' : 'muted'} tabular>
              {time}
            </AppText>
          </View>
          <View style={styles.metaLine}>
            <CategoryIcon categoryId={job?.categoryId} size="xs" style={styles.categoryIcon} />
            <AppText variant="caption" color="secondary" numberOfLines={1} style={styles.flexShrink}>
              {role ? `${categoryName} · ${role}` : categoryName}
            </AppText>
            {closed ? <Badge label={t('messaging:conversations.closed')} icon="lock-outline" size="sm" style={styles.noShrink} /> : null}
          </View>
          <View style={styles.previewLine}>
            <AppText
              variant={unread ? 'bodyStrong' : 'body'}
              color={unread ? 'default' : preview ? 'secondary' : 'muted'}
              numberOfLines={1}
              style={styles.preview}
            >
              {previewText}
            </AppText>
            {unread ? (
              <View style={styles.unreadBadge}>
                <AppText variant="tiny" color="onPrimary" tabular>
                  {format.number(conversation.unreadCount)}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

export function ConversationRowSkeleton() {
  const styles = useStyles();
  return (
    <Card padding="md">
      <View style={styles.row}>
        <Skeleton circle height={44} />
        <View style={[styles.texts, styles.skeletonTexts]}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="35%" height={11} />
          <Skeleton width="80%" height={12} />
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs + 1,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
    paddingTop: t.spacing.xxs,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  name: {
    flex: 1,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
  },
  categoryIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  flexShrink: {
    flexShrink: 1,
  },
  noShrink: {
    flexShrink: 0,
  },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.xxs,
  },
  preview: {
    flex: 1,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: t.spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
}));
