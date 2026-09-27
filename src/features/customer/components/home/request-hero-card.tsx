import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Icon, withAlpha, type IconName } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';

const PERKS: readonly { key: 'free' | 'verified' | 'compare'; icon: IconName }[] = [
  { key: 'free', icon: 'gift-outline' },
  { key: 'verified', icon: 'shield-check-outline' },
  { key: 'compare', icon: 'scale-balance' },
];

export interface RequestHeroCardProps {
  /** Opens the service picker. */
  onSearch: () => void;
}

/** Prominent "Request a service" card with a search-like entry point. */
export function RequestHeroCard({ onSearch }: RequestHeroCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('customer');
  const onColor = theme.colors.onPrimary;
  const glass = withAlpha(onColor, 0.14);

  return (
    <LinearGradient
      colors={theme.colors.heroGradient}
      start={{ x: theme.isRTL ? 1 : 0, y: 0 }}
      end={{ x: theme.isRTL ? 0 : 1, y: 1 }}
      style={styles.card}
    >
      <View style={[styles.decor, styles.decorLarge, { backgroundColor: glass }]} />
      <View style={[styles.decor, styles.decorSmall, { backgroundColor: glass }]} />

      <View style={styles.texts}>
        <View style={[styles.eyebrow, { backgroundColor: glass }]}>
          <Icon name="lightning-bolt" size={14} color={onColor} />
          <AppText variant="label" color="onPrimary">
            {t('home.hero.eyebrow')}
          </AppText>
        </View>
        <AppText variant="title" color="onPrimary" accessibilityRole="header">
          {t('home.hero.title')}
        </AppText>
        <AppText variant="body" color={withAlpha(onColor, 0.86)}>
          {t('home.hero.subtitle')}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel={t('home.hero.searchA11y')}
        onPress={onSearch}
        testID="home-request-search"
        style={({ pressed }) => [styles.search, pressed ? styles.searchPressed : null]}
      >
        <Icon name="magnify" size={22} color="primary" />
        <AppText variant="body" color="muted" numberOfLines={1} style={styles.searchText}>
          {t('home.hero.searchPlaceholder')}
        </AppText>
        <View style={styles.searchAction}>
          <Icon name="arrow-right" size={18} color="onPrimary" flipInRTL />
        </View>
      </Pressable>

      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk.key} style={styles.perk}>
            <Icon name={perk.icon} size={14} color={withAlpha(onColor, 0.9)} />
            <AppText variant="label" color={withAlpha(onColor, 0.9)} numberOfLines={1}>
              {t(`home.hero.perks.${perk.key}`)}
            </AppText>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    borderRadius: t.radii.xxl,
    padding: t.spacing.xl,
    gap: t.spacing.lg,
    overflow: 'hidden',
    ...t.shadows.lg,
  },
  decor: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorLarge: {
    width: 220,
    height: 220,
    top: -90,
    end: -70,
  },
  decorSmall: {
    width: 120,
    height: 120,
    bottom: -60,
    start: -30,
  },
  texts: {
    gap: t.spacing.xs,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xxs + 1,
    borderRadius: t.radii.pill,
    marginBottom: t.spacing.xs,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: 54,
    paddingStart: t.spacing.lg,
    paddingEnd: t.spacing.sm,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    ...t.shadows.md,
  },
  searchPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  searchText: {
    flex: 1,
  },
  searchAction: {
    width: 38,
    height: 38,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: t.spacing.lg,
    rowGap: t.spacing.xs,
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
}));
