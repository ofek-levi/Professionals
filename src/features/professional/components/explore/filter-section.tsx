import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/theme';

interface FilterSectionProps {
  title: string;
  children: ReactNode;
}

/** Titled group of chips inside the filters sheet. */
export function FilterSection({ title, children }: FilterSectionProps) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <AppText variant="subheading" accessibilityRole="header" numberOfLines={1}>
        {title}
      </AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
}));
