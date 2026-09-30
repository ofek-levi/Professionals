/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Deleting the account with the real route tree (`src/app`) against the test double: Settings →
 * Account → Delete account, the impact per role, the password check (inline error, 429, offline),
 * the last confirmation, then signed out on this device (no server logout) with a toast. A
 * Google-only account confirms with Google, which tests (no Google client id) cannot offer.
 */
import { cleanup, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { apiClient } from '@/services/api';
import type { Transport } from '@/services/api/transport';
import { sessionStore } from '@/services/auth/session-store';
import { realtimeClient } from '@/services/realtime';
import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '@/test-utils/mock-backend/data/seed';
import { buildMockGoogleIdToken } from '@/test-utils/mock-backend/server/google-id-token';
import { SEED_PASSWORD } from '@/test-utils/mock-backend/server/passwords';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.setTimeout(30_000);

const TIMEOUT = { timeout: 10_000 };
const NOA = MAIN_CUSTOMER_IDS.noa;
let env: TestEnvironment;

beforeAll(() => {
  // `expo-router/testing-library` installs Reanimated's official mock, which lacks
  // `useReducedMotion` (used by skeletons).
  const reanimated = require('react-native-reanimated') as Record<string, unknown>;
  reanimated.useReducedMotion ??= () => false;
});

beforeEach(() => {
  // Deleting changes the data: a fresh double for every test.
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
});

afterEach(async () => {
  // Unmount first so signing out doesn't update a tree outside of `act`.
  await cleanup();
  await sessionStore.signOut();
  queryClient.clear();
  jest.restoreAllMocks();
  await i18n.changeLanguage('en');
  // `renderRouter` switches to fake timers.
  jest.useRealTimers();
});

async function renderApp(initialUrl: string) {
  const result = renderRouter('./src/app', { initialUrl });
  await result;
  return { getPathname: () => result.getPathname() };
}

async function openDeleteAccount(userId: string) {
  await sessionStore.signIn(env.signIn(userId));
  const app = await renderApp('/settings');
  const account = await screen.findByTestId('settings-account', {}, TIMEOUT);
  expect(within(account).getByRole('header', { name: 'Account' })).toBeOnTheScreen();
  await fireEvent.press(within(account).getByTestId('settings-delete-account'));
  await waitFor(() => expect(app.getPathname()).toBe('/settings/delete-account'), TIMEOUT);
  await screen.findByTestId('deletion-changes', {}, TIMEOUT);
  return app;
}

const typePassword = (password: string) => fireEvent.changeText(screen.getByTestId('delete-account-password'), password);

/** Presses "Delete account" in the last confirmation. */
async function confirmDeletion() {
  const actions = await screen.findByTestId('confirm-dialog-actions', {}, TIMEOUT);
  await fireEvent.press(within(actions).getByRole('button', { name: 'Delete account' }));
}

describe('delete account', () => {
  it('shows a customer what is cancelled and what stays, with the Privacy Policy', async () => {
    await openDeleteAccount(NOA);
    const db = env.server.internals.db;
    const active = db.requests.filter(
      (request) =>
        request.customerId === NOA &&
        ['open', 'offers_received', 'professional_selected', 'scheduled', 'in_progress'].includes(request.status),
    );
    const pendingOffers = active.reduce((sum, request) => sum + request.pendingOfferCount, 0);

    expect(screen.getByText('This can’t be undone')).toBeOnTheScreen();
    const group = (key: string) => within(screen.getByTestId(`deletion-${key}`));
    expect(group('requests').getByText(`${active.length} requests will be cancelled`)).toBeOnTheScreen();
    expect(
      group('offersDeclined').getByText(`${pendingOffers} offers on them will be declined – the professionals are notified`),
    ).toBeOnTheScreen();
    expect(group('customerJobs').getByText('1 job will be cancelled – the professional is notified')).toBeOnTheScreen();
    // The job's category, date and the hired professional's name.
    const lighting = db.jobs.require(SEED_IDS.jobs.noaLighting, 'Job');
    const pro = db.professionals.require(lighting.professionalId, 'Professional').displayName;
    expect(group('customerJobs').getByText(new RegExp(` · ${pro}$`))).toBeOnTheScreen();
    expect(group('drafts').getByText('1 draft will be deleted')).toBeOnTheScreen();

    const keeps = screen.getByTestId('deletion-keeps');
    expect(within(keeps).getByText('Your ratings stay, without your comments.')).toBeOnTheScreen();
    expect(within(keeps).getByText(/with you shown as “Deleted user”/)).toBeOnTheScreen();
    expect(within(keeps).getByRole('link', { name: 'Privacy Policy' })).toBeOnTheScreen();
    // Nothing was deleted by looking.
    expect(env.log.to('/me/deletion', 'POST')).toEqual([]);
  });

  it('shows a professional the offers withdrawn and the jobs cancelled', async () => {
    await openDeleteAccount(PRO_IDS.avi);
    const pending = env.server.internals.db.offers.count((offer) => offer.professionalId === PRO_IDS.avi && offer.status === 'pending');
    const offers = within(screen.getByTestId('deletion-offersWithdrawn'));
    expect(offers.getByText(new RegExp(`^${pending} offers? will be withdrawn – the customers? (is|are) notified$`))).toBeOnTheScreen();
    expect(offers.getByText(/ · Noa L\.$/)).toBeOnTheScreen();
    expect(screen.queryByTestId('deletion-drafts')).toBeNull();
    expect(screen.queryByText('Your ratings stay, without your comments.')).toBeNull();
  });

  it('asks for the password, shows a wrong one inline and keeps the account', async () => {
    const app = await openDeleteAccount(NOA);
    await fireEvent.press(screen.getByTestId('delete-account-submit'));
    expect(await screen.findByText('Enter your password', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.queryByTestId('confirm-dialog-actions')).toBeNull();

    await typePassword('wrong-password1');
    await fireEvent.press(screen.getByTestId('delete-account-submit'));
    await confirmDeletion();
    expect(await screen.findByText('The password is incorrect', {}, TIMEOUT)).toBeOnTheScreen();
    expect(env.log.to('/me/deletion', 'POST')).toEqual([expect.objectContaining({ status: 400, body: { password: 'wrong-password1' } })]);
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId: NOA });
    expect(app.getPathname()).toBe('/settings/delete-account');
  });

  it('says when to try again after too many attempts (429) and when offline', async () => {
    let answer: 'rateLimited' | 'offline' = 'rateLimited';
    const transport: Transport = async (request) => {
      if (request.path !== '/me/deletion') return env.transport(request);
      return answer === 'rateLimited'
        ? { status: 429, data: { code: 'RATE_LIMITED', message: 'Too many attempts' }, headers: { 'retry-after': '600' } }
        : { status: 0, data: { code: 'NETWORK_ERROR', message: 'offline' } };
    };
    apiClient.setTransport(transport);
    await openDeleteAccount(NOA);
    await typePassword(SEED_PASSWORD);

    await fireEvent.press(screen.getByTestId('delete-account-submit'));
    await confirmDeletion();
    expect(await screen.findByTestId('delete-account-paused', {}, TIMEOUT)).toHaveTextContent(/Too many attempts.*10 minutes/);

    answer = 'offline';
    await fireEvent.press(screen.getByTestId('delete-account-submit'));
    await confirmDeletion();
    expect(await screen.findByText('No connection', {}, TIMEOUT)).toBeOnTheScreen();
    expect(sessionStore.getState().status).toBe('signedIn');
  });

  it('deletes the account, signs out here without a server logout and says so', async () => {
    const order: string[] = [];
    const disconnect = jest.spyOn(realtimeClient, 'disconnect').mockImplementation(() => {
      order.push('realtime closed');
    });
    apiClient.setTransport((request) => {
      if (request.path === '/me/deletion') order.push('POST /me/deletion');
      return env.transport(request);
    });
    const app = await openDeleteAccount(NOA);
    await typePassword(SEED_PASSWORD);
    await fireEvent.press(screen.getByTestId('delete-account-submit'));
    // Cancelling the last confirmation sends nothing.
    const actions = await screen.findByTestId('confirm-dialog-actions', {}, TIMEOUT);
    await fireEvent.press(within(actions).getByRole('button', { name: 'Cancel' }));
    expect(env.log.to('/me/deletion', 'POST')).toEqual([]);
    order.length = 0;

    await fireEvent.press(screen.getByTestId('delete-account-submit'));
    await confirmDeletion();
    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), TIMEOUT);
    expect(await screen.findByText('Your account was deleted', {}, TIMEOUT)).toBeOnTheScreen();
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(env.log.to('/me/deletion', 'POST')).toEqual([expect.objectContaining({ status: 200, body: { password: SEED_PASSWORD } })]);
    expect(env.log.to('/auth/logout', 'POST')).toEqual([]);
    // Realtime closed before the server closes the account's sockets.
    expect(order[0]).toBe('realtime closed');
    expect(order[1]).toBe('POST /me/deletion');
    expect(disconnect).toHaveBeenCalled();
    expect(env.server.internals.db.users.require(NOA, 'User').deletedAt).toBeDefined();
  });

  it('asks a Google-only account to confirm with Google (unavailable without a Google client id)', async () => {
    const maya = { email: 'maya.katz@gmail.com', firstName: 'Maya', lastName: 'Katz' };
    const session = await env.as(null).auth.register({
      role: 'customer',
      ...maya,
      phone: '0501234567',
      password: null,
      googleIdToken: buildMockGoogleIdToken(maya),
      acceptedTerms: true,
      preferredLanguage: 'en',
      professional: null,
    });
    await openDeleteAccount(session.user.id);
    expect(screen.getByTestId('deletion-nothing')).toHaveTextContent(/^Nothing is in progress/);
    expect(screen.queryByTestId('delete-account-password')).toBeNull();
    expect(screen.queryByTestId('delete-account-submit')).toBeNull();
    expect(screen.getByText(/Confirming with Google isn’t available here/)).toBeOnTheScreen();
  });

  it('reads in Hebrew', async () => {
    await i18n.changeLanguage('he');
    await sessionStore.signIn(env.signIn(NOA));
    await renderApp('/settings/delete-account');
    expect(await screen.findByText('אי אפשר לבטל את המחיקה', {}, TIMEOUT)).toBeOnTheScreen();
    expect(within(screen.getByTestId('deletion-customerJobs')).getByText('עבודה אחת תבוטל – בעל המקצוע יקבל הודעה')).toBeOnTheScreen();
    expect(within(screen.getByTestId('deletion-drafts')).getByText('טיוטה אחת תימחק')).toBeOnTheScreen();
  });
});
