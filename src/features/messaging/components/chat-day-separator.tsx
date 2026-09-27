import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { useFormatters } from '@/i18n/hooks';
import { makeStyles } from '@/theme';

import type { ChatDayRow } from './chat-model';

/** Centered day pill between messages: "Today", "Yesterday", "Wednesday", "Sep 12". */
export function ChatDaySeparator({ row, now }: { row: ChatDayRow; now: Date }) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  let label: string;
  if (row.daysAgo <= 0) label = t('time.today');
  else if (row.daysAgo === 1) label = t('time.yesterday');
  else if (row.daysAgo < 7) label = format.date(row.day, 'weekday');
  else label = format.date(row.day, row.day.getFullYear() === now.getFullYear() ? 'short' : 'medium');

  return (
    <View style={styles.container} accessibilityRole="header">
      <View style={styles.pill}>
        <AppText variant="label" color="secondary">
          {label}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    alignItems: 'center',
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.xs,
  },
  pill: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
}));
