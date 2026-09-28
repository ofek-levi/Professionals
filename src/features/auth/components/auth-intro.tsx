import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/theme';

/** Title and one line of context at the top of an auth screen or sign-up step. */
export function AuthIntro({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.intro}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="secondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  intro: {
    gap: t.spacing.xs,
  },
}));
