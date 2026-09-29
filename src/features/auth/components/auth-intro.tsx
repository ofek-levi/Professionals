import { View } from 'react-native';

import { AppText, BrandMark, withAlpha } from '@/components/ui';
import { makeStyles, useTheme } from '@/theme';

interface AuthIntroProps {
  title: string;
  subtitle?: string;
  /**
   * Sign-in screen: the logo in a soft tile of its own blue, centred above a centred title and
   * subtitle. Otherwise the intro is start-aligned text only (sign-up steps, forgot password).
   */
  withBrandMark?: boolean;
}

/** Title and one line of context at the top of an auth screen or sign-up step. */
export function AuthIntro({ title, subtitle, withBrandMark = false }: AuthIntroProps) {
  const styles = useStyles();
  const theme = useTheme();
  const align = withBrandMark ? 'center' : undefined;
  return (
    <View style={[styles.intro, withBrandMark ? styles.centered : null]}>
      {withBrandMark ? (
        <View style={[styles.markTile, { backgroundColor: withAlpha(theme.colors.brandMark, 0.1) }]} testID="auth-brand-mark">
          <BrandMark size={44} />
        </View>
      ) : null}
      <AppText variant="title" align={align} accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="secondary" align={align}>
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
  centered: {
    alignItems: 'center',
  },
  markTile: {
    width: 88,
    height: 88,
    borderRadius: t.radii.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: t.spacing.xl,
  },
}));
