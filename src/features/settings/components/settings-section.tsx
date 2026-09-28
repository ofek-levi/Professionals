import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { makeStyles } from '@/theme';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  /** Render the children on the soft group surface with hairlines between rows (default). */
  grouped?: boolean;
  testID?: string;
}

/** Titled settings group: rows on one soft surface, separated by hairlines. */
export function SettingsSection({ title, children, grouped = true, testID }: SettingsSectionProps) {
  const styles = useStyles();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {grouped ? (
        <Card padding="none" style={styles.card}>
          {rows.map((row, index) => (
            <Fragment key={row.key ?? index}>
              {index > 0 ? <View style={styles.divider} /> : null}
              {row}
            </Fragment>
          ))}
        </Card>
      ) : (
        children
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  card: {
    paddingHorizontal: t.spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.border,
  },
}));
