import { Platform, Switch } from 'react-native';

import { useTheme } from '@/theme';

interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Hide from screen readers when the surrounding row is the accessible control (e.g. `SwitchRow`). */
  decorative?: boolean;
  testID?: string;
}

/**
 * The only switch primitive: themed track/thumb on every platform and mirrored in RTL.
 *
 * - Colors: brand track when on, white thumb in both states. React Native Web colors the "on"
 *   thumb with `activeThumbColor` (teal by default) instead of `thumbColor`, so both are set.
 * - RTL: React Native Web positions the thumb with logical offsets resolved against the app's
 *   writing direction (`LayoutDirectionRoot`), so the "on" thumb sits at the start edge in Hebrew
 *   like native switches; no per-switch direction override is needed.
 */
export function AppSwitch({ value, onValueChange, disabled = false, accessibilityLabel, decorative = false, testID }: AppSwitchProps) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: theme.colors.borderStrong, true: theme.colors.primary }}
      thumbColor={theme.colors.onPrimary}
      activeThumbColor={Platform.OS === 'web' ? theme.colors.onPrimary : undefined}
      ios_backgroundColor={theme.colors.borderStrong}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      testID={testID}
    />
  );
}
