import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Card, SectionHeader, type IconName } from '@/components/ui';
import { makeStyles } from '@/theme';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: IconName;
  children: ReactNode;
  testID?: string;
}

/** Titled settings group rendered as a card. */
export function SettingsSection({ title, description, icon, children, testID }: SettingsSectionProps) {
  const styles = useStyles();
  return (
    <View style={styles.section} testID={testID}>
      <SectionHeader title={title} icon={icon} style={styles.header} />
      {description ? (
        <AppText variant="caption" color="muted" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      <Card variant="outlined" padding="none" style={styles.card}>
        {children}
      </Card>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.xs,
  },
  header: {
    marginBottom: 0,
  },
  description: {
    marginBottom: t.spacing.xs,
  },
  card: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.xs,
  },
}));
