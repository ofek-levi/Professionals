import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/theme';

/** A hairline with "or" in the middle, between email sign-in and "Continue with Google". */
export function OrDivider({ label }: { label?: string }) {
  const styles = useStyles();
  const { t } = useTranslation('auth');
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <AppText variant="caption" color="muted">
        {label ?? t('google.or')}
      </AppText>
      <View style={styles.line} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: t.colors.border,
  },
}));
