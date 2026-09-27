/** Profile completeness meter with the next most valuable things to add. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, Icon, type IconSource } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';

import type { CompletenessItem, ProfileCompleteness } from '../../profile-completeness';

const ITEM_ICONS: Record<CompletenessItem, IconSource> = {
  photo: 'camera-outline',
  bio: 'text-account',
  categories: 'toolbox-outline',
  headline: 'format-title',
  baseLocation: 'home-map-marker',
  availability: 'calendar-clock-outline',
  license: 'card-account-details-outline',
  insurance: 'shield-check-outline',
  startingPrice: 'cash',
  website: 'web',
};

const MAX_SUGGESTIONS = 3;

export function CompletenessCard({ completeness, onEdit }: { completeness: ProfileCompleteness; onEdit: () => void }) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('professional');
  const format = useFormatters();
  const tone = completeness.isComplete ? 'success' : completeness.percent >= 70 ? 'brand' : 'warning';
  const colors = theme.colors.tones[tone];

  return (
    <Card variant="elevated" padding="lg" style={styles.card} testID="pro-account-completeness">
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="subheading">{t('account.completeness.title')}</AppText>
          <AppText variant="caption" color="secondary">
            {completeness.isComplete ? t('account.completeness.complete') : t('account.completeness.description')}
          </AppText>
        </View>
        <AppText variant="title" color={colors.fg} tabular>
          {t('account.completeness.percent', { value: format.number(completeness.percent) })}
        </AppText>
      </View>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('account.completeness.title')}
        accessibilityValue={{ min: 0, max: 100, now: completeness.percent }}
      >
        <View style={[styles.fill, { width: `${completeness.percent}%`, backgroundColor: colors.solid }]} />
      </View>
      {!completeness.isComplete ? (
        <>
          <View style={styles.items}>
            {completeness.missing.slice(0, MAX_SUGGESTIONS).map((item) => (
              <View key={item} style={styles.item}>
                <View style={styles.itemIcon}>
                  <Icon name={ITEM_ICONS[item]} size={16} color="primary" />
                </View>
                <AppText variant="caption" style={styles.flex}>
                  {t(`account.completeness.items.${item}`)}
                </AppText>
                <Icon name="plus-circle-outline" size={18} color="muted" />
              </View>
            ))}
          </View>
          <Button label={t('account.completeness.cta')} variant="secondary" leftIcon="account-edit-outline" onPress={onEdit} fullWidth />
        </>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  track: {
    height: 10,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: t.radii.pill,
  },
  items: {
    gap: t.spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
