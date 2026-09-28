/**
 * Design tokens. Components must use these (through `useTheme()` / `makeStyles`) instead of
 * hard-coded colors, sizes or fonts.
 */
import type { StatusTone } from '@/constants/tones';

interface ToneColors {
  /** Foreground (text/icon) color. */
  fg: string;
  /** Soft background. */
  bg: string;
  /** Solid color (markers, filled badges). */
  solid: string;
}

export interface ColorPalette {
  /** Screen background: white (light) / near-black (dark). */
  background: string;
  /** Soft filled surface for content groups (cards, list groups, inputs, secondary buttons). */
  surface: string;
  /** Slightly stronger fill (nested groups, tracks, placeholders). */
  surfaceMuted: string;
  /** Pressed state of filled surfaces. */
  surfacePressed: string;
  /** Floating layers only: sheets, dialogs, toasts. */
  surfaceElevated: string;
  /** Hairline dividers and input outlines. */
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  /** Brand color for text, icons, links, dots and bars. */
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  /**
   * Brand fill behind `onPrimary` content (filled buttons, selected tiles and chips, count
   * bubbles, own chat bubbles). Equals `primary` in light mode; deeper in dark mode, where the
   * lighter `primary` keeps text readable on the dark background but not white labels on it.
   */
  primaryFill: string;
  primaryFillPressed: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  dangerSoft: string;
  info: string;
  star: string;
  overlay: string;
  skeleton: string;
  tabBar: string;
  shadow: string;
  heroGradient: readonly [string, string];
  proGradient: readonly [string, string];
  tones: Record<StatusTone, ToneColors>;
}

const lightTones: Record<StatusTone, ToneColors> = {
  neutral: { fg: '#4A4F59', bg: '#F1F2F4', solid: '#6B7079' },
  info: { fg: '#1E63A8', bg: '#EAF3FC', solid: '#1C7ED6' },
  success: { fg: '#2B7A3D', bg: '#EAF6EC', solid: '#2B8A3E' },
  warning: { fg: '#B25600', bg: '#FFF3E5', solid: '#F08C00' },
  danger: { fg: '#C23030', bg: '#FDEEEE', solid: '#E03131' },
  accent: { fg: '#0B7456', bg: '#E7F7F1', solid: '#0CA678' },
  brand: { fg: '#3450C4', bg: '#EEF1FD', solid: '#3B5BDB' },
};

const darkTones: Record<StatusTone, ToneColors> = {
  neutral: { fg: '#C7CAD1', bg: 'rgba(199, 202, 209, 0.10)', solid: '#8D919A' },
  info: { fg: '#7CBFF7', bg: 'rgba(124, 191, 247, 0.12)', solid: '#339AF0' },
  success: { fg: '#8FD9A0', bg: 'rgba(143, 217, 160, 0.12)', solid: '#2B8A3E' },
  warning: { fg: '#F7BE7C', bg: 'rgba(247, 190, 124, 0.12)', solid: '#FD7E14' },
  danger: { fg: '#F7A6A6', bg: 'rgba(247, 166, 166, 0.12)', solid: '#D62F2F' },
  accent: { fg: '#6EDDBB', bg: 'rgba(110, 221, 187, 0.11)', solid: '#20C997' },
  brand: { fg: '#A9B9FF', bg: 'rgba(122, 147, 255, 0.15)', solid: '#6E8BFF' },
};

const lightColors: ColorPalette = {
  background: '#FFFFFF',
  surface: '#F4F5F7',
  surfaceMuted: '#ECEDF0',
  surfacePressed: '#E6E7EB',
  surfaceElevated: '#FFFFFF',
  border: '#E8E9ED',
  borderStrong: '#D3D6DC',
  text: '#15171C',
  textSecondary: '#50555F',
  // ≥ 4.5:1 on the background and on `surface` (meta lines, timestamps, hints).
  textMuted: '#6B7079',
  textInverse: '#FFFFFF',
  primary: '#3B5BDB',
  primaryPressed: '#2F4BC0',
  primarySoft: '#EEF1FD',
  primaryFill: '#3B5BDB',
  primaryFillPressed: '#2F4BC0',
  onPrimary: '#FFFFFF',
  accent: '#0CA678',
  accentSoft: '#E7F7F1',
  success: '#2F9E44',
  warning: '#F08C00',
  danger: '#E03131',
  dangerSoft: '#FDEEEE',
  info: '#1C7ED6',
  star: '#F5A623',
  overlay: 'rgba(12, 14, 20, 0.42)',
  skeleton: '#EDEEF1',
  tabBar: '#FFFFFF',
  shadow: 'rgba(16, 18, 24, 0.08)',
  heroGradient: ['#3B5BDB', '#4A67E0'],
  proGradient: ['#3B5BDB', '#4A67E0'],
  tones: lightTones,
};

export const darkColors: ColorPalette = {
  background: '#0C0D10',
  surface: '#17181C',
  surfaceMuted: '#202227',
  surfacePressed: '#26282E',
  surfaceElevated: '#1B1C21',
  border: '#24262B',
  borderStrong: '#33363D',
  text: '#F2F3F5',
  textSecondary: '#AEB2BA',
  textMuted: '#7D818A',
  textInverse: '#0C0D10',
  primary: '#6E8BFF',
  primaryPressed: '#5A76EB',
  primarySoft: 'rgba(110, 139, 255, 0.15)',
  // White labels need a deeper fill than the text-friendly `primary` (≈ 4.8:1).
  primaryFill: '#4466F0',
  primaryFillPressed: '#3A57D9',
  onPrimary: '#FFFFFF',
  accent: '#20C997',
  accentSoft: 'rgba(32, 201, 151, 0.12)',
  success: '#40C057',
  warning: '#FD7E14',
  danger: '#FA5252',
  dangerSoft: 'rgba(250, 82, 82, 0.12)',
  info: '#339AF0',
  star: '#FCC419',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#1D1F24',
  tabBar: '#0C0D10',
  shadow: 'rgba(0, 0, 0, 0.5)',
  heroGradient: ['#3A55C9', '#4461D6'],
  proGradient: ['#3A55C9', '#4461D6'],
  tones: darkTones,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  /** Horizontal screen padding. */
  screen: 20,
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

/** Font families (Rubik supports both Latin and Hebrew). Loaded in the root layout. */
export const fontFamilies = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fontFamilies.bold, fontSize: 30, lineHeight: 38 },
  /** Tab screen titles. */
  largeTitle: { fontFamily: fontFamilies.bold, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fontFamilies.semibold, fontSize: 22, lineHeight: 30 },
  /** Section titles, sheet titles. */
  heading: { fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 24 },
  subheading: { fontFamily: fontFamilies.medium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamilies.medium, fontSize: 12, lineHeight: 16 },
  tiny: { fontFamily: fontFamilies.medium, fontSize: 11, lineHeight: 14 },
} as const;
export type TypographyVariant = keyof typeof typography;

/** Restrained shadows – only for floating layers (sheets, dialogs, toasts) and selected segments. */
export const shadows = {
  none: {},
  sm: { boxShadow: '0px 1px 2px rgba(16, 18, 24, 0.08)' },
  md: { boxShadow: '0px 4px 12px rgba(16, 18, 24, 0.06)' },
  lg: { boxShadow: '0px 12px 32px rgba(16, 18, 24, 0.12)' },
} as const;

export const layout = {
  /** Minimum touch target (accessibility). */
  minTouchSize: 44,
  maxContentWidth: 720,
  /** Tab bar height above the bottom safe-area inset. */
  tabBarHeight: 56,
  /** Vertical space between screen sections. */
  sectionGap: 28,
} as const;

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorPalette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  fonts: typeof fontFamilies;
  shadows: typeof shadows;
  layout: typeof layout;
  /** Mirrors `I18nManager.isRTL` for the active language. */
  isRTL: boolean;
}

export function createTheme(scheme: 'light' | 'dark', isRTL: boolean): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radii,
    typography,
    fonts: fontFamilies,
    shadows,
    layout,
    isRTL,
  };
}
