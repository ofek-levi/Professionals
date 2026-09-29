import { View } from 'react-native';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/theme';

/** A hairline with a short label in the middle (e.g. "or sign up with email" after "Continue with Google"). */
export function OrDivider({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <AppText variant="caption" color="muted">
        {label}
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
