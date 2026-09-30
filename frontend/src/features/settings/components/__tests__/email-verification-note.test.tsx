/**
 * "Email updates" only reach a verified address: while `/me` says `emailVerified: false`, the
 * setting explains it and sends a new verification link (`POST /auth/verify-email/resend`).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { ToastProvider } from '@/components/ui';
import { i18n, initI18n } from '@/i18n';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { useNotificationPreferenceRows } from '../notification-preference-rows';

const NOA = MAIN_CUSTOMER_IDS.noa;
let env: TestEnvironment;

function Rows() {
  return <>{useNotificationPreferenceRows()}</>;
}

function setVerified(verified: boolean) {
  const { credentials } = env.server.internals.db;
  const credential = credentials.find((row) => row.userId === NOA);
  if (!credential) throw new Error('seed');
  credentials.update(credential.email, { emailVerified: verified });
}

beforeAll(async () => {
  await initI18n('en');
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
});

afterEach(async () => {
  await sessionStore.signOut();
  env.log.clear();
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('email updates of an unverified address', () => {
  it('explains why nothing arrives and sends a new verification link', async () => {
    setVerified(false);
    await sessionStore.signIn(env.signIn(NOA));
    await renderWithProviders(
      <ToastProvider>
        <Rows />
      </ToastProvider>,
    );
    const note = await screen.findByTestId('email-verification-note');
    expect(note).toHaveTextContent(/to receive email updates/);
    const meFetches = env.log.to('/me', 'GET').length;
    // Inside `act` until the request, its toast and the `/me` refetch have all settled.
    await act(async () => {
      fireEvent.press(screen.getByText('Send a new link'));
      for (let i = 0; i < 50 && env.log.to('/me', 'GET').length === meFetches; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(env.log.to('/auth/verify-email/resend', 'POST')).toHaveLength(1);
    expect(screen.getByText(/We’ve sent a new link to/)).toBeOnTheScreen();
    // `/me` was refetched (the address may have been verified meanwhile).
    expect(env.log.to('/me', 'GET').length).toBeGreaterThan(meFetches);
  });

  it('shows no note once the address is verified', async () => {
    setVerified(true);
    await sessionStore.signIn(env.signIn(NOA));
    await renderWithProviders(
      <ToastProvider>
        <Rows />
      </ToastProvider>,
    );
    await screen.findByTestId('notification-preference-emailEnabled');
    expect(screen.queryByTestId('email-verification-note')).toBeNull();
  });
});
