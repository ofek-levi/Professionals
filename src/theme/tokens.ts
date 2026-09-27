/**
 * Design tokens. Components must use these (through `useTheme()` / `makeStyles`) instead of
 * hard-coded colors, sizes or fonts.
 */
import type { StatusTone } from '@/constants/tones';

export interface ToneColors {
  /** Foreground (text/icon) color. */
  fg: string;
  /** Soft background. */
  bg: string;
  /** Solid color (markers, filled badges). */
  solid: string;
}

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfacePressed: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
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
  neutral: { fg: '#4B5563', bg: '#F1F3F7', solid: '#6B7280' },
  info: { fg: '#1864AB', bg: '#E7F5FF', solid: '#1C7ED6' },
  success: { fg: '#2B8A3E', bg: '#EBFBEE', solid: '#2F9E44' },
  warning: { fg: '#C25E00', bg: '#FFF4E6', solid: '#F08C00' },
  danger: { fg: '#C92A2A', bg: '#FFF0F0', solid: '#E03131' },
  accent: { fg: '#087F5B', bg: '#E6FCF5', solid: '#0CA678' },
  brand: { fg: '#364FC7', bg: '#EDF1FF', solid: '#3B5BDB' },
};

const darkTones: Record<StatusTone, ToneColors> = {
  neutral: { fg: '#C3CAD9', bg: 'rgba(195, 202, 217, 0.12)', solid: '#8B93A7' },
  info: { fg: '#74C0FC', bg: 'rgba(116, 192, 252, 0.14)', solid: '#339AF0' },
  success: { fg: '#8CE99A', bg: 'rgba(140, 233, 154, 0.13)', solid: '#40C057' },
  warning: { fg: '#FFC078', bg: 'rgba(255, 192, 120, 0.14)', solid: '#FD7E14' },
  danger: { fg: '#FFA8A8', bg: 'rgba(255, 168, 168, 0.14)', solid: '#FA5252' },
  accent: { fg: '#63E6BE', bg: 'rgba(99, 230, 190, 0.13)', solid: '#20C997' },
  brand: { fg: '#A5B8FF', bg: 'rgba(110, 139, 255, 0.18)', solid: '#6E8BFF' },
};

export const lightColors: ColorPalette = {
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2F7',
  surfacePressed: '#E8EBF3',
  border: '#E3E6EE',
  borderStrong: '#CBD1DD',
  text: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#8A93A6',
  textInverse: '#FFFFFF',
  primary: '#3B5BDB',
  primaryPressed: '#2F49B8',
  primarySoft: '#EDF1FF',
  onPrimary: '#FFFFFF',
  accent: '#0CA678',
  accentSoft: '#E6FCF5',
  success: '#2F9E44',
  warning: '#F08C00',
  danger: '#E03131',
  dangerSoft: '#FFF0F0',
  info: '#1C7ED6',
  star: '#FAB005',
  overlay: 'rgba(15, 23, 42, 0.5)',
  skeleton: '#E6E9F0',
  tabBar: '#FFFFFF',
  shadow: 'rgba(17, 24, 39, 0.08)',
  heroGradient: ['#3B5BDB', '#5F3DC4'],
  proGradient: ['#087F5B', '#1864AB'],
  tones: lightTones,
};

export const darkColors: ColorPalette = {
  background: '#0B1020',
  surface: '#141B2F',
  surfaceMuted: '#1B2339',
  surfacePressed: '#222C46',
  border: '#27314B',
  borderStrong: '#36425F',
  text: '#F3F5FA',
  textSecondary: '#B6BED1',
  textMuted: '#7F8AA3',
  textInverse: '#0B1020',
  primary: '#6E8BFF',
  primaryPressed: '#5A76EB',
  primarySoft: 'rgba(110, 139, 255, 0.16)',
  onPrimary: '#FFFFFF',
  accent: '#20C997',
  accentSoft: 'rgba(32, 201, 151, 0.14)',
  success: '#40C057',
  warning: '#FD7E14',
  danger: '#FA5252',
  dangerSoft: 'rgba(250, 82, 82, 0.14)',
  info: '#339AF0',
  star: '#FCC419',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#1F2840',
  tabBar: '#10172A',
  shadow: 'rgba(0, 0, 0, 0.4)',
  heroGradient: ['#3048B8', '#4C2D9E'],
  proGradient: ['#0B6B4F', '#174E86'],
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
  title: { fontFamily: fontFamilies.semibold, fontSize: 22, lineHeight: 30 },
  heading: { fontFamily: fontFamilies.semibold, fontSize: 18, lineHeight: 24 },
  subheading: { fontFamily: fontFamilies.medium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 18 },
  captionStrong: { fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamilies.medium, fontSize: 12, lineHeight: 16 },
  tiny: { fontFamily: fontFamilies.medium, fontSize: 11, lineHeight: 14 },
} as const;
export type TypographyVariant = keyof typeof typography;

export const shadows = {
  none: {},
  sm: { boxShadow: '0px 1px 3px rgba(17, 24, 39, 0.08)' },
  md: { boxShadow: '0px 4px 14px rgba(17, 24, 39, 0.08)' },
  lg: { boxShadow: '0px 10px 30px rgba(17, 24, 39, 0.14)' },
} as const;

export const layout = {
  /** Minimum touch target (accessibility). */
  minTouchSize: 44,
  maxContentWidth: 720,
  tabBarHeight: 64,
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
