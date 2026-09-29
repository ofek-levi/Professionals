import { useRef, useState } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, haptics, Icon, ListItem, Sheet } from '@/components/ui';
import { useChangeLanguage } from '@/features/settings/use-change-language';
import { useAppLanguage } from '@/i18n/hooks';
import { makeStyles } from '@/theme';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/types/domain';

/**
 * Header pill with the current language (sign-in screen). It opens a bottom sheet listing the
 * supported languages, each written in its own language.
 */
export function LanguageMenuButton({ style, testID = 'language-menu' }: { style?: StyleProp<ViewStyle>; testID?: string }) {
  const styles = useStyles();
  const { t } = useTranslation(['auth', 'common']);
  const language = useAppLanguage();
  const changeLanguage = useChangeLanguage();
  const [open, setOpen] = useState(false);
  // Applied once the sheet has fully closed: on a phone, switching between English and Hebrew
  // first asks to restart the app, and iOS cannot present that dialog over a closing sheet.
  const pending = useRef<AppLanguage | null>(null);

  const choose = (option: AppLanguage) => {
    haptics.selection();
    pending.current = option === language ? null : option;
    setOpen(false);
  };

  const applyPending = () => {
    const next = pending.current;
    pending.current = null;
    if (next) void changeLanguage(next);
  };

  const languageName = t(`common:languages.${language}`);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth:language.button', { language: languageName })}
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
        hitSlop={6}
        style={({ pressed }) => [styles.pill, pressed ? styles.pressed : null, style]}
        testID={testID}
      >
        <Icon name="translate" size={16} color="secondary" />
        <AppText variant="captionStrong">{languageName}</AppText>
        <Icon name="chevron-down" size={18} color="secondary" />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        onClosed={applyPending}
        title={t('auth:language.sheetTitle')}
        testID={`${testID}-sheet`}
      >
        {SUPPORTED_LANGUAGES.map((option) => {
          const selected = option === language;
          return (
            <ListItem
              key={option}
              title={t(`common:languages.${option}`)}
              onPress={() => choose(option)}
              showChevron={false}
              checked={selected}
              trailing={selected ? <Icon name="check" size={22} color="primary" /> : null}
              testID={`${testID}-${option}`}
            />
          );
        })}
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    minHeight: 36,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radii.pill,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  pressed: {
    opacity: 0.7,
  },
}));
