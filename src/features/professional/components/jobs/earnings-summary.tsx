/** Earnings summary above the completed jobs. */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon } from '@/components/ui';
import { APP_CONFIG } from '@/constants/app-config';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';

import type { CompletedJobsSummary } from '../../home-model';

export function EarningsSummary({ summary }: { summary: CompletedJobsSummary }) {
  const styles = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('professional');
  const format = useFormatters();
  const formatTotals = (totals: CompletedJobsSummary['totals']) =>
    totals.length === 0
      ? format.currency(0, APP_CONFIG.defaultCurrency)
      : totals.map((total) => format.currency(total.amount, total.currency)).join(' · ');

  return (
    <Card variant="elevated" padding="lg" style={styles.card} testID="pro-jobs-earnings">
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.tones.success.bg }]}>
          <Icon name="cash-multiple" size={22} color="success" />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color="muted">
            {t('jobs.earnings.total')}
          </AppText>
          <AppText variant="title" tabular numberOfLines={1}>
            {formatTotals(summary.totals)}
          </AppText>
        </View>
      </View>
      <View style={styles.facts}>
        <View style={styles.fact}>
          <AppText variant="tiny" color="muted">
            {t('jobs.earnings.thisMonth')}
          </AppText>
          <AppText variant="bodyStrong" tabular numberOfLines={1}>
            {formatTotals(summary.thisMonthTotals)}
          </AppText>
        </View>
        <View style={styles.divider} />
        <View style={styles.fact}>
          <AppText variant="tiny" color="muted">
            {t('jobs.earnings.completed')}
          </AppText>
          <AppText variant="bodyStrong" tabular>
            {format.number(summary.count)}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    gap: t.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.lg,
    paddingTop: t.spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  fact: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: t.colors.border,
  },
}));
