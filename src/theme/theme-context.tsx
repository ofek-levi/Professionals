import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { createTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(createTheme('light', false));

export interface AppThemeProviderProps {
  scheme: 'light' | 'dark';
  isRTL: boolean;
  children: ReactNode;
}

export function AppThemeProvider({ scheme, isRTL, children }: AppThemeProviderProps) {
  const theme = useMemo(() => createTheme(scheme, isRTL), [scheme, isRTL]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Creates a hook returning memoized, theme-aware styles:
 *
 * const useStyles = makeStyles((t) => ({ card: { backgroundColor: t.colors.surface } }));
 * const styles = useStyles();
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T): () => T {
  return function useStyles() {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
