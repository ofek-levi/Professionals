import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme, type Theme } from '@/theme';

export interface DividerProps {
  /** Indent from the start edge (e.g. to align with list item text). */
  inset?: number;
  vertical?: boolean;
  /** Vertical spacing token around a horizontal divider. */
  spacing?: keyof Theme['spacing'];
  style?: StyleProp<ViewStyle>;
}

/** Hairline separator. */
export function Divider({ inset = 0, vertical = false, spacing, style }: DividerProps) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        vertical ? styles.vertical : styles.horizontal,
        !vertical && inset ? { marginStart: inset } : null,
        spacing ? (vertical ? { marginHorizontal: theme.spacing[spacing] } : { marginVertical: theme.spacing[spacing] }) : null,
        style,
      ]}
    />
  );
}

export interface SpacerProps {
  /** Spacing token (default `lg`). */
  size?: keyof Theme['spacing'];
  horizontal?: boolean;
  /** Fills the remaining space in a flex row/column. */
  flex?: boolean;
}

/** Explicit whitespace from the spacing scale. */
export function Spacer({ size = 'lg', horizontal = false, flex = false }: SpacerProps) {
  const theme = useTheme();
  if (flex) return <View style={{ flex: 1 }} />;
  const value = theme.spacing[size];
  return <View style={horizontal ? { width: value } : { height: value }} />;
}

const useStyles = makeStyles((t) => ({
  horizontal: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: t.colors.border,
  },
  vertical: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: t.colors.border,
  },
}));
