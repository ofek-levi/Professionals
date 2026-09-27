/**
 * Marker visuals shared by the native (`react-native-maps` custom markers) and the web map, so both
 * platforms look identical.
 */
import { View } from 'react-native';

import type { StatusTone } from '@/constants/tones';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from '../ui/app-text';
import { Icon, type IconSource } from '../ui/icon';

export const MARKER_SIZE = 34;
export const MARKER_SELECTED_SIZE = 44;
export const PIN_HEAD_SIZE = 44;
export const PIN_STEM_HEIGHT = 12;

export interface MarkerBubbleProps {
  tone?: StatusTone;
  icon?: IconSource;
  label?: string;
  selected?: boolean;
}

/** Round colored marker with a glyph; selected markers grow, get a halo and show their label. */
export function MarkerBubble({ tone = 'brand', icon = 'map-marker', label, selected = false }: MarkerBubbleProps) {
  const theme = useTheme();
  const styles = useStyles();
  const colors = theme.colors.tones[tone];
  const size = selected ? MARKER_SELECTED_SIZE : MARKER_SIZE;

  return (
    <View style={styles.markerContainer}>
      <View
        style={[
          styles.halo,
          {
            width: size + 12,
            height: size + 12,
            borderRadius: (size + 12) / 2,
            backgroundColor: selected ? colors.bg : 'transparent',
          },
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.solid,
            },
          ]}
        >
          <Icon name={icon} size={selected ? 22 : 18} color={theme.colors.onPrimary} />
        </View>
      </View>
      {selected && label ? (
        <View style={styles.label}>
          <AppText variant="tiny" numberOfLines={1} maxFontSizeMultiplier={1.1}>
            {label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Classic teardrop location pin (anchor: bottom center). */
export function LocationPin({ lifted = false }: { lifted?: boolean }) {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.pinContainer}>
      <View style={[styles.pinHead, lifted ? styles.pinLifted : null]}>
        <Icon name="home-map-marker" size={24} color={theme.colors.onPrimary} />
      </View>
      <View style={styles.pinStem} />
      <View style={[styles.pinShadow, lifted ? styles.pinShadowLifted : null]} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  markerContainer: {
    alignItems: 'center',
    pointerEvents: 'none',
  },
  halo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: t.colors.surface,
    ...t.shadows.md,
  },
  label: {
    marginTop: t.spacing.xxs,
    maxWidth: 140,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadows.sm,
  },
  pinContainer: {
    alignItems: 'center',
    pointerEvents: 'none',
    width: PIN_HEAD_SIZE,
  },
  pinHead: {
    width: PIN_HEAD_SIZE,
    height: PIN_HEAD_SIZE,
    borderRadius: PIN_HEAD_SIZE / 2,
    backgroundColor: t.colors.primary,
    borderWidth: 3,
    borderColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadows.lg,
  },
  pinLifted: {
    transform: [{ translateY: -6 }, { scale: 1.06 }],
  },
  pinStem: {
    width: 4,
    height: PIN_STEM_HEIGHT,
    marginTop: -2,
    borderBottomStartRadius: 2,
    borderBottomEndRadius: 2,
    backgroundColor: t.colors.primary,
  },
  pinShadow: {
    width: 14,
    height: 5,
    marginTop: -2,
    borderRadius: 7,
    backgroundColor: t.colors.overlay,
    opacity: 0.35,
  },
  pinShadowLifted: {
    width: 18,
    opacity: 0.2,
  },
}));
