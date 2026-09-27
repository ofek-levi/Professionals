import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Icon, type IconSource } from '@/components/ui';
import { makeStyles } from '@/theme';

export interface FilterSectionProps {
  title: string;
  icon: IconSource;
  hint?: string;
  /** Short summary of the current selection, shown on the end of the title row. */
  summary?: string;
  children: ReactNode;
}

/** Titled group inside the filters sheet. */
export function FilterSection({ title, icon, hint, summary, children }: FilterSectionProps) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.iconBox}>
          <Icon name={icon} size={16} color="primary" />
        </View>
        <AppText variant="subheading" accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        {summary ? (
          <AppText variant="caption" color="muted" numberOfLines={1} style={styles.summary}>
            {summary}
          </AppText>
        ) : null}
      </View>
      {hint ? (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      ) : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  summary: {
    maxWidth: '45%',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    paddingTop: t.spacing.xs,
  },
}));
