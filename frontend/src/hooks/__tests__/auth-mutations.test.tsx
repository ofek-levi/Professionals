/**
 * Auth mutations against the real endpoint modules and the in-app mock backend: each sign-in path
 * establishes the session through the session store (with the session lifecycle running, so the
 * cache is cleared exactly like after a demo sign-in).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { pendingGoogleSignUpStore } from '@/features/auth/pending-google-sign-up';
import { startSessionLifecycle } from '@/features/auth/session-lifecycle';
import { useGoogleAuth, useLogin, useRegister, useRequestPasswordReset } from '@/hooks/mutations/use-auth-mutations';
import { DEMO_CUSTOMER_IDS, PRO_IDS } from '@/mocks/data/seed';
import { DEMO_ACCOUNT_PASSWORD } from '@/mocks/server/passwords';
import { createTestEnvironment, type TestEnvironment } from '@/mocks/testing/test-server';
import { createMockTransport } from '@/mocks/transport';
import { apiClient, isApiError } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import { buildMockGoogleIdToken } from '@/services/auth/google-id-token';
import type { RegisterRequest } from '@/types/api';

let env: TestEnvironment;
let stopLifecycle: (() => void) | null = null;
const realtime = { connect: jest.fn(), disconnect: jest.fn() };

beforeAll(async () => {
  env = await createTestEnvironment();
  apiClient.setTransport(createMockTransport(env.server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 }).transport);
  // Like the app after launch: the session resolved to "signed out" before anyone signs in.
  await sessionStore.hydrate();
});

afterEach(async () => {
  stopLifecycle?.();
  stopLifecycle = null;
  pendingGoogleSignUpStore.clear();
  await sessionStore.signOut();
  realtime.connect.mockClear();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const clear = jest.spyOn(client, 'clear');
  stopLifecycle = startSessionLifecycle({ store: sessionStore, queryClient: client, realtime, registerDevice: () => Promise.resolve(true) });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, clear, wrapper: Wrapper };
}

const registerPayload = (overrides: Partial<RegisterRequest> = {}): RegisterRequest => ({
  role: 'customer',
  firstName: 'Hila',
  lastName: 'Sade',
  email: `hila.${Math.random().toString(36).slice(2, 8)}@example.org`,
  phone: '0521234567',
  password: 'Secret123',
  googleIdToken: null,
  acceptedTerms: true,
  preferredLanguage: 'en',
  professional: null,
  ...overrides,
});

describe('useLogin', () => {
  it('signs in with email + password through the session store', async () => {
    const { wrapper, clear } = setup();
    const { result } = await renderHook(() => useLogin(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ email: 'avi@aquafix.example.com', password: DEMO_ACCOUNT_PASSWORD });
    });
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId: PRO_IDS.avi, role: 'professional' });
    expect(realtime.connect).toHaveBeenCalledWith(`demo-token:${PRO_IDS.avi}`);
    expect(clear).toHaveBeenCalled();
  });

  it('stays signed out on INVALID_CREDENTIALS', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useLogin(), { wrapper });
    let caught: unknown;
    await act(async () => {
      await result.current.mutateAsync({ email: 'noa.levi@example.com', password: 'nope' }).catch((error: unknown) => {
        caught = error;
      });
    });
    expect(isApiError(caught) && caught.code).toBe('INVALID_CREDENTIALS');
    expect(sessionStore.getState().status).toBe('signedOut');
  });
});

describe('useRegister', () => {
  it('creates the account and signs in', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useRegister(), { wrapper });
    let userId = '';
    await act(async () => {
      const session = await result.current.mutateAsync(registerPayload());
      userId = session.user.id;
    });
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId, role: 'customer' });
  });
});

describe('useGoogleAuth', () => {
  it('signs an existing account in', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useGoogleAuth(), { wrapper });
    await act(async () => {
      const response = await result.current.mutateAsync(
        buildMockGoogleIdToken({ email: 'noa.levi@example.com', firstName: 'Noa', lastName: 'Levi' }),
      );
      expect(response.status).toBe('signed_in');
    });
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId: DEMO_CUSTOMER_IDS.noa });
    expect(pendingGoogleSignUpStore.get()).toBeNull();
  });

  it('keeps a new identity pending until the sign-up completes', async () => {
    const { wrapper } = setup();
    const idToken = buildMockGoogleIdToken({ email: 'new.person@gmail.com', firstName: 'New', lastName: 'Person' });
    const { result } = await renderHook(() => ({ google: useGoogleAuth(), register: useRegister() }), { wrapper });
    await act(async () => {
      await result.current.google.mutateAsync(idToken);
    });
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(pendingGoogleSignUpStore.get()).toEqual({
      idToken,
      profile: { email: 'new.person@gmail.com', firstName: 'New', lastName: 'Person', avatarUrl: null },
    });

    await act(async () => {
      await result.current.register.mutateAsync(
        registerPayload({ firstName: 'New', lastName: 'Person', email: 'new.person@gmail.com', password: null, googleIdToken: idToken }),
      );
    });
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', role: 'customer' });
    expect(pendingGoogleSignUpStore.get()).toBeNull();
  });
});

describe('useRequestPasswordReset', () => {
  it('always succeeds for a valid email without signing in', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useRequestPasswordReset(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ email: 'unknown@example.org' })).resolves.toEqual({ success: true });
    });
    expect(sessionStore.getState().status).toBe('signedOut');
  });
});
