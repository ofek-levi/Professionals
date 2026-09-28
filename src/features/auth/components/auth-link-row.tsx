import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui';
import { makeStyles } from '@/theme';

interface AuthLinkRowProps {
  /** Leading question, e.g. "New here?". */
  prompt: string;
  /** The link, e.g. "Create account". */
  actionLabel: string;
  onPress: () => void;
  testID?: string;
}

/** Centered "New here? Create account" line at the bottom of auth screens. */
export function AuthLinkRow({ prompt, actionLabel, onPress, testID }: AuthLinkRowProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <AppText variant="body" color="secondary">
        {prompt}
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={onPress}
        hitSlop={12}
        style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
        testID={testID}
      >
        <AppText variant="bodyStrong" color="primary">
          {actionLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: t.spacing.xs,
  },
  link: {
    minHeight: t.layout.minTouchSize,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
}));
