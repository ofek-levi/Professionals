import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '@/theme';

interface DividerProps {
  /** Indent from the start edge (e.g. to align with list item text). */
  inset?: number;
  style?: StyleProp<ViewStyle>;
}

/** Hairline separator. */
export function Divider({ inset = 0, style }: DividerProps) {
  const styles = useStyles();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.horizontal, inset ? { marginStart: inset } : null, style]} />
  );
}

const useStyles = makeStyles((t) => ({
  horizontal: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: t.colors.border,
  },
}));
