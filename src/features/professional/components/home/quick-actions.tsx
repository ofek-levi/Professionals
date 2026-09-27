/** Shortcut tiles on the professional home. */
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, SectionHeader, type IconSource } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { routes } from '@/lib/routes';
import { makeStyles, useTheme } from '@/theme';
import type { Href } from 'expo-router';

interface QuickAction {
  key: string;
  icon: IconSource;
  tone: StatusTone;
  label: string;
  href: Href;
}

export function QuickActions() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation('professional');
  const actions: QuickAction[] = [
    { key: 'browse', icon: 'map-search-outline', tone: 'brand', label: t('home.quickActions.browse'), href: routes.professional.explore },
    { key: 'offers', icon: 'tag-multiple-outline', tone: 'info', label: t('home.quickActions.offers'), href: routes.professional.offers },
    { key: 'profile', icon: 'account-edit-outline', tone: 'accent', label: t('home.quickActions.profile'), href: routes.editProfile },
  ];
  return (
    <View>
      <SectionHeader title={t('home.quickActions.title')} icon="lightning-bolt-outline" />
      <View style={styles.grid}>
        {actions.map((action) => {
          const colors = theme.colors.tones[action.tone];
          return (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => router.push(action.href)}
              style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
              testID={`pro-home-quick-${action.key}`}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
                <Icon name={action.icon} size={22} color={colors.fg} />
              </View>
              <AppText variant="captionStrong" align="center" numberOfLines={2}>
                {action.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  grid: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.lg,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    minHeight: 104,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
