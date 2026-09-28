import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, haptics, withAlpha, type IconName } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import { alignForText } from '@/utils/bidi';

import type { ChatMessageRow, FailedMessage, MessageDeliveryState } from './chat-model';

interface MessageBubbleProps {
  row: ChatMessageRow;
  counterpartName: string;
  onRetry: (message: FailedMessage) => void;
  onDiscard: (message: FailedMessage) => void;
}

const DELIVERY_ICONS: Record<MessageDeliveryState, IconName> = {
  sending: 'clock-outline',
  sent: 'check',
  read: 'check-all',
  failed: 'alert-circle',
};

/**
 * Chat bubble. The current user's messages sit on the end side in the primary color, the
 * counterpart's on the start side on a surface; both mirror correctly in RTL. The bottom corner
 * on the sender's side is the "tail"; consecutive messages of one sender are grouped (tighter
 * spacing, flattened top corner).
 */
export function MessageBubble({ row, counterpartName, onRetry, onDiscard }: MessageBubbleProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('messaging');
  const format = useFormatters();
  const { message, mine, delivery, failed } = row;
  const time = format.time(message.createdAt);
  const metaColor = mine ? withAlpha(theme.colors.onPrimary, 0.78) : theme.colors.textMuted;

  const deliveryLabel = delivery ? t(`chat.${delivery === 'failed' ? 'failedA11y' : delivery}`) : null;
  const accessibilityLabel = [
    mine ? t('chat.a11y.fromYou', { time, text: message.text }) : t('chat.a11y.fromOther', { name: counterpartName, time, text: message.text }),
    deliveryLabel,
  ]
    .filter(Boolean)
    .join('. ');

  const bubble = (
    <View
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        row.groupedWithPrevious ? (mine ? styles.mineJoinedTop : styles.theirsJoinedTop) : null,
        delivery === 'sending' ? styles.sending : null,
        delivery === 'failed' ? styles.failedBubble : null,
      ]}
    >
      <AppText
        variant="body"
        color={mine ? 'onPrimary' : 'default'}
        align={alignForText(message.text, theme.isRTL)}
        selectable={!failed}
      >
        {message.text}
      </AppText>
      <View style={styles.meta}>
        <AppText variant="tiny" color={metaColor} tabular>
          {time}
        </AppText>
        {delivery && delivery !== 'failed' ? <Icon name={DELIVERY_ICONS[delivery]} size={14} color={metaColor} /> : null}
      </View>
    </View>
  );

  if (failed) {
    return (
      <View style={[styles.container, styles.containerMine, row.groupedWithPrevious ? styles.joined : null]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={() => {
            haptics.light();
            onRetry(failed);
          }}
          onLongPress={() => onDiscard(failed)}
          style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
          testID={`chat-failed-${failed.clientMessageId}`}
        >
          {bubble}
          <View style={styles.failedLine}>
            <Icon name={DELIVERY_ICONS.failed} size={14} color="danger" />
            <AppText variant="tiny" color="danger">
              {t('chat.failed')}
            </AppText>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, mine ? styles.containerMine : styles.containerTheirs, row.groupedWithPrevious ? styles.joined : null]}
      accessible
      accessibilityLabel={accessibilityLabel}
      testID={`chat-message-${message.id}`}
    >
      {bubble}
    </View>
  );
}

const BUBBLE_RADIUS = 20;
const JOINED_RADIUS = 6;

const useStyles = makeStyles((t) => ({
  container: {
    maxWidth: '80%',
    marginTop: t.spacing.md,
  },
  containerMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  containerTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  joined: {
    marginTop: t.spacing.xxs,
  },
  pressable: {
    alignItems: 'flex-end',
    gap: t.spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  bubble: {
    paddingHorizontal: t.spacing.md + 2,
    paddingTop: t.spacing.sm + 1,
    paddingBottom: t.spacing.sm - 1,
    borderRadius: BUBBLE_RADIUS,
    gap: t.spacing.xxs,
  },
  mine: {
    backgroundColor: t.colors.primaryFill,
    borderBottomEndRadius: JOINED_RADIUS,
  },
  theirs: {
    backgroundColor: t.colors.surface,
    borderBottomStartRadius: JOINED_RADIUS,
  },
  mineJoinedTop: {
    borderTopEndRadius: JOINED_RADIUS,
  },
  theirsJoinedTop: {
    borderTopStartRadius: JOINED_RADIUS,
  },
  sending: {
    opacity: 0.72,
  },
  failedBubble: {
    backgroundColor: t.colors.tones.danger.solid,
    opacity: 0.85,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: t.spacing.xxs + 1,
  },
  failedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.xs,
  },
}));
