import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, haptics, Icon, withAlpha } from '@/components/ui';
import { useChangeLanguage } from '@/features/settings/use-change-language';
import { useAppLanguage } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/types/domain';

interface LanguageSwitchProps {
  /** `onColor` renders light-on-dark for gradients/hero areas. */
  appearance?: 'default' | 'onColor';
  style?: StyleProp<ViewStyle>;
}

/** Compact English / עברית toggle. Language names are always shown in their own language. */
export function LanguageSwitch({ appearance = 'default', style }: LanguageSwitchProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['auth', 'common']);
  const language = useAppLanguage();
  const changeLanguage = useChangeLanguage();
  const onColor = appearance === 'onColor';

  const trackColor = onColor ? withAlpha(theme.colors.onPrimary, 0.16) : theme.colors.surfaceMuted;
  const selectedColor = onColor ? theme.colors.onPrimary : theme.colors.surface;

  const select = (next: AppLanguage) => {
    if (next === language) return;
    haptics.selection();
    void changeLanguage(next);
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('auth:language.label')}
      style={[styles.track, { backgroundColor: trackColor }, style]}
    >
      {onColor ? <Icon name="translate" size={16} color={theme.colors.onPrimary} style={styles.icon} /> : null}
      {SUPPORTED_LANGUAGES.map((option) => {
        const selected = option === language;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={t(`common:languages.${option}`)}
            onPress={() => select(option)}
            hitSlop={4}
            style={({ pressed }) => [
              styles.option,
              selected ? { backgroundColor: selectedColor } : null,
              pressed && !selected ? styles.pressed : null,
            ]}
          >
            <AppText
              variant="captionStrong"
              color={selected ? (onColor ? theme.colors.primary : 'default') : onColor ? 'onPrimary' : 'secondary'}
            >
              {t(`common:languages.${option}`)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: t.spacing.xxs + 1,
    borderRadius: t.radii.pill,
    gap: t.spacing.xxs,
  },
  icon: {
    marginHorizontal: t.spacing.xs,
  },
  option: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
}));
