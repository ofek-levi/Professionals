import { View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { makeStyles } from '@/theme';

export interface StepIntroProps {
  icon: IconName;
  title: string;
  subtitle?: string;
}

/** Title block at the top of every wizard step. */
export function StepIntro({ icon, title, subtitle }: StepIntroProps) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Icon name={icon} size={24} color="primary" />
      </View>
      <View style={styles.texts}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
}));
