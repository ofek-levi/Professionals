/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Deleting the account with the real route tree (`src/app`) against the test double: Settings →
 * Account → Delete account, the impact per role, the password check (inline error, 429, offline),
 * the last confirmation, then signed out on this device (no server logout) with a toast; an account
 * already deleted elsewhere (401) ends the session with its own toast. A Google-only account
 * confirms with Google (the Google prompt is a stand-in here; without a client id there is none).
 */
import { cleanup, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { apiClient } from '@/services/api';
import type { Transport } from '@/services/api/transport';
import { googleAuthConfig } from '@/services/auth/google-auth';
import { sessionStore } from '@/services/auth/session-store';
import type { RealGoogleIdToken } from '@/services/auth/use-real-google-id-token';
import { realtimeClient } from '@/services/realtime';
import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '@/test-utils/mock-backend/data/seed';
import { buildMockGoogleIdToken } from '@/test-utils/mock-backend/server/google-id-token';
import { SEED_PASSWORD } from '@/test-utils/mock-backend/server/passwords';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
/** Google's sign-in: none by default (the tests have no Google client id). */
const mockGoogle: RealGoogleIdToken = { isAvailable: false, isReady: false, prompt: async () => null };
jest.mock('@/services/auth/use-real-google-id-token', () => ({ useRealGoogleIdToken: () => mockGoogle }));

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
  Object.assign(mockGoogle, { isAvailable: false, isReady: false, prompt: async () => null });
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
    // Those nobody made an offer on are deleted rather than kept as cancelled.
    expect(
      group('requests').getByText(`${active.length} requests will be cancelled (those without offers are deleted)`),
    ).toBeOnTheScreen();
    expect(group('offersDeclined').getByText(`${pendingOffers} offers on them will be declined`)).toBeOnTheScreen();
    expect(group('customerJobs').getByText('1 job will be cancelled')).toBeOnTheScreen();
    // The job's category, date and the hired professional's name.
    const lighting = db.jobs.require(SEED_IDS.jobs.noaLighting, 'Job');
    const pro = db.professionals.require(lighting.professionalId, 'Professional').displayName;
    expect(group('customerJobs').getByText(new RegExp(` · ${pro}$`))).toBeOnTheScreen();
    expect(group('drafts').getByText('1 draft will be deleted')).toBeOnTheScreen();
    // One line for everyone notified: nothing reaches those who turned the category off.
    expect(screen.getByTestId('deletion-notified')).toHaveTextContent(
      'The other people involved are notified, unless they turned off “Offers & job updates” notifications.',
    );

    // What stays: the records the account-deletion page lists.
    const keeps = screen.getByTestId('deletion-keeps');
    const row = (key: string) => within(within(keeps).getByTestId(`deletion-keeps-${key}`));
    expect(
      row('jobs').getByText('Your jobs, including completed and cancelled ones, stay in the professionals’ history, with you shown as “Deleted user”.'),
    ).toBeOnTheScreen();
    expect(
      row('requests').getByText(/^Requests that received offers stay .*without the street address, apartment details, photos or cancellation comments\.$/),
    ).toBeOnTheScreen();
    expect(within(keeps).getByText('Your ratings stay, without your comments.')).toBeOnTheScreen();
    expect(within(keeps).getByTestId('deletion-keeps-messages')).toBeOnTheScreen();
    expect(within(keeps).queryByTestId('deletion-keeps-offers')).toBeNull();
    expect(within(keeps).getByRole('link', { name: 'Privacy Policy' })).toBeOnTheScreen();
    // Nothing was deleted by looking.
    expect(env.log.to('/me/deletion', 'POST')).toEqual([]);
  });

  it('shows a professional the offers withdrawn and the jobs cancelled', async () => {
    await openDeleteAccount(PRO_IDS.avi);
    const pending = env.server.internals.db.offers.count((offer) => offer.professionalId === PRO_IDS.avi && offer.status === 'pending');
    const offers = within(screen.getByTestId('deletion-offersWithdrawn'));
    expect(offers.getByText(new RegExp(`^${pending} offers? will be withdrawn$`))).toBeOnTheScreen();
    expect(screen.getByTestId('deletion-notified')).toBeOnTheScreen();
    expect(offers.getByText(/ · Noa L\.$/)).toBeOnTheScreen();
    expect(screen.queryByTestId('deletion-drafts')).toBeNull();

    const keeps = within(screen.getByTestId('deletion-keeps'));
    const row = (key: string) => within(keeps.getByTestId(`deletion-keeps-${key}`));
    expect(row('jobs').getByText(/stay in the customers’ history, with you shown as “Deleted user”\.$/)).toBeOnTheScreen();
    expect(
      row('offers').getByText('Your offers keep their price and proposed time, without your message, for the customers who received them.'),
    ).toBeOnTheScreen();
    expect(row('reviews').getByText(/^Reviews about you stay in the job history of the customers who wrote them/)).toBeOnTheScreen();
    expect(keeps.queryByTestId('deletion-keeps-requests')).toBeNull();
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

  it('ends the session of an account already deleted elsewhere (401) and says so, not "signed out"', async () => {
    const app = await openDeleteAccount(NOA);
    // Deleted on another device (or by a first attempt whose answer was lost).
    await env.as(NOA).users.deleteAccount({ password: SEED_PASSWORD });
    await typePassword(SEED_PASSWORD);
    await fireEvent.press(screen.getByTestId('delete-account-submit'));
    await confirmDeletion();

    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), TIMEOUT);
    expect(await screen.findByText('This account no longer exists', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.queryByText('You’ve been signed out')).toBeNull();
    expect(screen.queryByText('Please sign in again')).toBeNull();
    expect(sessionStore.getState().status).toBe('signedOut');
    expect(env.log.to('/me/deletion', 'POST').map((request) => request.status)).toEqual([200, 401]);
    expect(env.log.to('/auth/logout', 'POST')).toEqual([]);
  });

  const maya = { email: 'maya.katz@gmail.com', firstName: 'Maya', lastName: 'Katz' };

  /** A customer who signed up with Google (no password). */
  async function registerWithGoogle() {
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
    return session.user.id;
  }

  /** Google sign-in is configured, and its prompt answers with `idToken`. */
  function withGoogle(idToken: string) {
    jest.replaceProperty(googleAuthConfig, 'available', true);
    Object.assign(mockGoogle, { isAvailable: true, isReady: true, prompt: jest.fn(async () => idToken) });
  }

  it('deletes a Google-only account confirmed with its Google account', async () => {
    withGoogle(buildMockGoogleIdToken(maya));
    const userId = await registerWithGoogle();
    const app = await openDeleteAccount(userId);
    expect(screen.getByText('To confirm, sign in with the Google account linked to this account.')).toBeOnTheScreen();
    expect(screen.queryByTestId('delete-account-password')).toBeNull();

    await fireEvent.press(screen.getByTestId('delete-account-google'));
    await confirmDeletion();
    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), TIMEOUT);
    expect(await screen.findByText('Your account was deleted', {}, TIMEOUT)).toBeOnTheScreen();
    expect(env.log.to('/me/deletion', 'POST')).toEqual([
      expect.objectContaining({ status: 200, body: { googleIdToken: buildMockGoogleIdToken(maya) } }),
    ]);
    expect(sessionStore.getState().status).toBe('signedOut');
  });

  it('keeps the account when another Google account confirms', async () => {
    withGoogle(buildMockGoogleIdToken({ email: 'someone.else@gmail.com', firstName: 'Someone', lastName: 'Else' }));
    const userId = await registerWithGoogle();
    const app = await openDeleteAccount(userId);
    await fireEvent.press(screen.getByTestId('delete-account-google'));
    await confirmDeletion();

    expect(await screen.findByTestId('delete-account-google-mismatch', {}, TIMEOUT)).toHaveTextContent(/That’s a different Google account/);
    expect(env.log.to('/me/deletion', 'POST')).toEqual([expect.objectContaining({ status: 400 })]);
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', userId });
    expect(env.server.internals.db.users.require(userId, 'User').deletedAt).toBeUndefined();
    expect(app.getPathname()).toBe('/settings/delete-account');
  });

  it('asks a Google-only account to confirm with Google (unavailable without a Google client id)', async () => {
    await openDeleteAccount(await registerWithGoogle());
    expect(screen.getByTestId('deletion-nothing')).toHaveTextContent(/^Nothing is in progress/);
    expect(screen.queryByTestId('deletion-notified')).toBeNull();
    expect(screen.queryByTestId('delete-account-password')).toBeNull();
    expect(screen.queryByTestId('delete-account-submit')).toBeNull();
    expect(screen.getByText(/Confirming with Google isn’t available here/)).toBeOnTheScreen();
  });

  it('reads in Hebrew', async () => {
    await i18n.changeLanguage('he');
    await sessionStore.signIn(env.signIn(NOA));
    await renderApp('/settings/delete-account');
    expect(await screen.findByText('אי אפשר לבטל את המחיקה', {}, TIMEOUT)).toBeOnTheScreen();
    expect(within(screen.getByTestId('deletion-requests')).getByText(/ יבוטלו \(אלה שלא התקבלו עליהן הצעות יימחקו\)$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId('deletion-customerJobs')).getByText('עבודה אחת תבוטל')).toBeOnTheScreen();
    expect(screen.getByTestId('deletion-notified')).toHaveTextContent(
      'המשתמשים האחרים המעורבים מקבלים על כך התראה, אלא אם כיבו את ההתראות ״הצעות ועדכוני עבודות״.',
    );
    expect(within(screen.getByTestId('deletion-drafts')).getByText('טיוטה אחת תימחק')).toBeOnTheScreen();
  });
});
