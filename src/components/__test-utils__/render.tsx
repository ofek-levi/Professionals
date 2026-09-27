/**
 * Test helpers for component tests: wraps the UI in the providers components expect
 * (React Query, theme, safe area). Not a test file itself.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppThemeProvider } from '@/theme';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export interface ProviderOptions {
  scheme?: 'light' | 'dark';
  isRTL?: boolean;
  queryClient?: QueryClient;
}

export function TestProviders({ children, scheme = 'light', isRTL = false, queryClient }: ProviderOptions & { children: ReactNode }) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={client}>
        <AppThemeProvider scheme={scheme} isRTL={isRTL}>
          {children}
        </AppThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const client = options.queryClient ?? createTestQueryClient();
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <TestProviders {...options} queryClient={client}>
        {children}
      </TestProviders>
    ),
  });
}
