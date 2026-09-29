import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, IconButton, resolveInputTextAlign } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { isSendableMessageText } from '@/features/messaging/message-rules';
import { makeStyles, useTheme } from '@/theme';
import { alignForTextDirection, getTextDirection } from '@/utils/bidi';

interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Called with the raw text; return `true` when it was sent (clears the input). */
  onSend: (text: string) => boolean;
  /** Closed conversation: read-only input and no send button. */
  disabled?: boolean;
}

/** Remaining-characters counter appears when this close to the limit. */
const COUNTER_THRESHOLD = 200;
/** Visible input height range (the input grows with its content up to the max, then scrolls). */
const MIN_INPUT_HEIGHT = 22;
const MAX_INPUT_HEIGHT = 120;
/** react-native-web renders a 2-row textarea by default; start with one row like on native. */
const WEB_SINGLE_ROW = (Platform.OS === 'web' ? { rows: 1 } : {}) as Record<string, unknown>;

/** Multiline message input with a send button that is enabled only for sendable text. */
export function ChatComposer({ value, onChangeText, onSend, disabled = false }: ChatComposerProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('messaging');
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(MIN_INPUT_HEIGHT);
  const inputHeight = Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, value ? contentHeight : MIN_INPUT_HEIGHT));
  const maxLength = APP_CONFIG.messageMaxLength;
  const remaining = maxLength - value.length;
  const canSend = !disabled && isSendableMessageText(value);
  const textDirection = getTextDirection(value);
  const textAlign = resolveInputTextAlign(alignForTextDirection(textDirection, theme.isRTL), theme);

  const send = () => {
    if (!canSend) return;
    if (onSend(value)) onChangeText('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.inputBox, focused ? styles.inputFocused : null, disabled ? styles.inputDisabled : null]}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={disabled ? t('chat.closedPlaceholder') : t('chat.placeholder')}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={maxLength}
            editable={!disabled}
            onContentSizeChange={(event) => setContentHeight(event.nativeEvent.contentSize.height)}
            scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
            {...WEB_SINGLE_ROW}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel={t('chat.placeholder')}
            style={[
              styles.input,
              { height: inputHeight, textAlign, writingDirection: textDirection ?? (theme.isRTL ? 'rtl' : 'ltr') },
            ]}
            testID="chat-input"
          />
        </View>
        <IconButton
          icon="send"
          flipInRTL
          variant="filled"
          size="lg"
          accessibilityLabel={t('chat.send')}
          disabled={!canSend}
          onPress={send}
          testID="chat-send"
        />
      </View>
      {!disabled && remaining <= COUNTER_THRESHOLD ? (
        <AppText variant="tiny" color={remaining <= 20 ? 'danger' : 'muted'} align="end" accessibilityLiveRegion="polite">
          {t('chat.charactersLeft', { count: remaining })}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.spacing.sm,
  },
  inputBox: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.spacing.lg,
  },
  inputFocused: {
    borderColor: t.colors.borderStrong,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  input: {
    ...t.typography.body,
    color: t.colors.text,
    marginVertical: t.spacing.md - 1,
    paddingTop: 0,
    paddingBottom: 0,
    // The rounded container shows focus; drop the browser's default outline on web.
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
}));
