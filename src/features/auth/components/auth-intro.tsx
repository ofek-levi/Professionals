import { View } from 'react-native';

import { AppText, BrandMark } from '@/components/ui';
import { makeStyles } from '@/theme';

interface AuthIntroProps {
  title: string;
  subtitle?: string;
  /** Shows the logo mark above the title (sign-in screen). */
  withBrandMark?: boolean;
}

/** Title and one line of context at the top of an auth screen or sign-up step. */
export function AuthIntro({ title, subtitle, withBrandMark = false }: AuthIntroProps) {
  const styles = useStyles();
  return (
    <View style={styles.intro}>
      {withBrandMark ? <BrandMark size={44} style={styles.mark} testID="auth-brand-mark" /> : null}
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
  mark: {
    marginBottom: t.spacing.lg - t.spacing.xs,
  },
}));
