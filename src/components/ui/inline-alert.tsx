import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Icon, type IconName, type IconSource } from './icon';

export interface InlineAlertProps {
  message: string;
  title?: string;
  tone?: StatusTone;
  /** Defaults to an icon matching the tone. */
  icon?: IconSource;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const TONE_ICONS: Record<StatusTone, IconName> = {
  neutral: 'information-outline',
  info: 'information-outline',
  success: 'check-circle-outline',
  warning: 'alert-outline',
  danger: 'alert-circle-outline',
  accent: 'lightbulb-on-outline',
  brand: 'star-four-points-outline',
};

/** Contextual message banner inside content (tips, warnings, permission problems). */
export function InlineAlert({ message, title, tone = 'info', icon, actionLabel, onAction, onDismiss, style, testID }: InlineAlertProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const colors = theme.colors.tones[tone];

  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.bg }, style]}
    >
      <Icon name={icon ?? TONE_ICONS[tone]} size={20} color={colors.fg} />
      <View style={styles.texts}>
        {title ? (
          <AppText variant="captionStrong" color={colors.fg}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="caption" color={title ? 'secondary' : colors.fg}>
          {message}
        </AppText>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}>
            <AppText variant="captionStrong" color={colors.fg} style={styles.actionText}>
              {actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.dismiss')} onPress={onDismiss} hitSlop={12}>
          <Icon name="close" size={18} color={colors.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Alias: full-width banner usage reads better as `<Banner />`. */
export const Banner = InlineAlert;
export type BannerProps = InlineAlertProps;

const useStyles = makeStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
    padding: t.spacing.md + 2,
    borderRadius: t.radii.md,
    borderWidth: 1,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs + 1,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: t.spacing.xs,
    minHeight: 28,
    justifyContent: 'center',
  },
  actionText: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.6,
  },
}));
