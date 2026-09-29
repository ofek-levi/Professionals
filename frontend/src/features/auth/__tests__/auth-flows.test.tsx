/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The account screens with the real route tree (`src/app`) against a zero-latency in-app mock
 * backend: the entry screen, email sign-in, the sign-up steps (validation per step, back
 * navigation, customer and professional), the simulated Google sign-in and the password reset.
 */
import { cleanup, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { emitMapMessage, getMapWebView } from '@/components/__test-utils__/map-bridge';
import { pendingGoogleSignUpStore } from '@/features/auth/pending-google-sign-up';
import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { createTestEnvironment, type TestEnvironment } from '@/mocks/testing/test-server';
import { createMockTransport } from '@/mocks/transport';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.setTimeout(60_000);

const TIMEOUT = { timeout: 10_000 };

let env: TestEnvironment;

beforeAll(async () => {
  // `expo-router/testing-library` installs Reanimated's official mock, which lacks
  // `useReducedMotion` (used by skeletons).
  const reanimated = require('react-native-reanimated') as Record<string, unknown>;
  reanimated.useReducedMotion ??= () => false;

  env = await createTestEnvironment();
  apiClient.setTransport(createMockTransport(env.server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 }).transport);
});

afterEach(async () => {
  // Unmount first so signing out doesn't update a tree outside of `act`.
  await cleanup();
  pendingGoogleSignUpStore.clear();
  await sessionStore.signOut();
  queryClient.clear();
  // `renderRouter` switches to fake timers.
  jest.useRealTimers();
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

async function renderApp(initialUrl: string) {
  const result = renderRouter('./src/app', { initialUrl });
  await result;
  return { getPathname: () => result.getPathname() };
}

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const type = (testID: string, text: string) => fireEvent.changeText(screen.getByTestId(testID), text);
const uniqueEmail = (name: string) => `${name}.${Math.random().toString(36).slice(2, 8)}@example.org`;

async function fillCustomerAccount(email: string) {
  await type('sign-up-first-name', 'Tamar');
  await type('sign-up-last-name', 'Ben-David');
  await type('sign-up-email', email);
  await type('sign-up-phone', '052-765-4321');
  await type('sign-up-password', 'Secret123');
  await type('sign-up-confirm-password', 'Secret123');
  await press('sign-up-terms');
}

describe('entry screen', () => {
  it('offers create account and sign in above the demo accounts', async () => {
    const app = await renderApp('/sign-in');
    expect(await screen.findByTestId('entry-create-account', {}, TIMEOUT)).toHaveTextContent('Create account');
    expect(screen.getByTestId('entry-sign-in')).toHaveTextContent('Sign in');
    // Decorative: hidden from screen readers, so the query has to include hidden elements.
    expect(screen.getByTestId('entry-brand-mark', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Or try a demo account')).toBeOnTheScreen();
    expect((await screen.findAllByTestId(/^demo-account-/, {}, TIMEOUT)).length).toBeGreaterThan(0);

    await press('entry-sign-in');
    await waitFor(() => expect(app.getPathname()).toBe('/auth/login'), TIMEOUT);
  });
});

describe('sign in', () => {
  it('validates, rejects wrong credentials with one alert and signs in', async () => {
    const app = await renderApp('/auth/login');
    await screen.findByTestId('login-screen', {}, TIMEOUT);
    expect(screen.getByTestId('auth-brand-mark', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('login-demo-hint')).toHaveTextContent(/noa\.levi@example\.com.*Demo1234/);

    await press('login-submit');
    expect(await screen.findByText('Enter your email address')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password')).toBeOnTheScreen();

    await type('login-email', 'noa@');
    await press('login-submit');
    expect(await screen.findByText('Enter a valid email address, e.g. name@example.com')).toBeOnTheScreen();

    await type('login-email', 'Noa.Levi@Example.com');
    await type('login-password', 'wrong-password1');
    await press('login-submit');
    expect(await screen.findByTestId('login-invalid-credentials', {}, TIMEOUT)).toHaveTextContent(/Wrong email or password/);

    // Editing the credentials hides the alert.
    await type('login-password', 'Demo1234');
    expect(screen.queryByTestId('login-invalid-credentials')).toBeNull();

    await press('login-submit');
    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), TIMEOUT);
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', role: 'customer' });
  });

  it('fills in the suggested demo account', async () => {
    const app = await renderApp('/auth/login');
    await screen.findByTestId('login-screen', {}, TIMEOUT);
    await press('login-fill-demo');
    expect(screen.getByTestId('login-email').props.value).toBe('noa.levi@example.com');
    expect(screen.getByTestId('login-password').props.value).toBe('Demo1234');
    await press('login-submit');
    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), TIMEOUT);
  });

  it('sends a password reset link without revealing whether the account exists', async () => {
    await renderApp('/auth/forgot-password');
    await press('forgot-password-submit');
    expect(await screen.findByText('Enter your email address')).toBeOnTheScreen();

    await type('forgot-password-email', 'Nobody@Example.com');
    await press('forgot-password-submit');
    expect(await screen.findByTestId('forgot-password-sent', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.getByText(/If an account exists for .*nobody@example\.com.*, we’ve sent a reset link\./)).toBeOnTheScreen();
    // The mock backend sends nothing, and says so.
    expect(screen.getByTestId('forgot-password-demo-note')).toHaveTextContent('Demo: no email is actually sent.');
  });
});

describe('sign up', () => {
  it('creates a customer account step by step', async () => {
    const app = await renderApp('/auth/sign-up');
    // The length of the flow depends on the role: no progress bar until one is chosen.
    expect(await screen.findByTestId('sign-up-step-role', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.queryByTestId('sign-up-progress')).toBeNull();
    // The logo stays on the entry and sign-in screens; the sign-up steps keep the space for the task.
    expect(screen.queryByTestId('auth-brand-mark', { includeHiddenElements: true })).toBeNull();

    // Step 1: the role is required.
    await press('sign-up-continue');
    expect(await screen.findByText('Choose how you’ll use Professionals')).toBeOnTheScreen();
    await press('sign-up-role-customer');
    expect(screen.getByTestId('sign-up-progress')).toHaveTextContent('Step 1 of 2');
    await press('sign-up-continue');
    expect(await screen.findByTestId('sign-up-step-account', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.getByTestId('sign-up-progress')).toHaveTextContent('Step 2 of 2');

    // Step 2: every field is checked before the account is created.
    await press('sign-up-continue');
    for (const message of [
      'Enter your first name',
      'Enter your last name',
      'Enter your email address',
      'Enter a phone number',
      'Enter your password',
      'Enter your password again',
      'Accept the Terms of Service and Privacy Policy to continue',
    ]) {
      expect(await screen.findByText(message)).toBeOnTheScreen();
    }
    await type('sign-up-password', 'short');
    expect(await screen.findByText('Use at least 8 characters')).toBeOnTheScreen();
    await type('sign-up-password', 'longpassword');
    expect(await screen.findByText('Include at least one letter and one number')).toBeOnTheScreen();
    await type('sign-up-password', 'Password1');
    expect(await screen.findByText('This password is too easy to guess. Try a less common one')).toBeOnTheScreen();

    // Both documents can be read before accepting them.
    await press('sign-up-terms-terms');
    const terms = await screen.findByTestId('legal-document-sheet', {}, TIMEOUT);
    expect(within(terms).getByText('Terms of Service')).toBeOnTheScreen();
    await press('legal-document-done');
    await waitFor(() => expect(screen.queryByTestId('legal-document-sheet')).toBeNull(), TIMEOUT);
    await press('sign-up-terms-privacy');
    expect(within(await screen.findByTestId('legal-document-sheet', {}, TIMEOUT)).getByText('Privacy Policy')).toBeOnTheScreen();
    await press('legal-document-done');
    await waitFor(() => expect(screen.queryByTestId('legal-document-sheet')).toBeNull(), TIMEOUT);

    // The header back arrow returns to the previous step instead of leaving (opened directly, the
    // header offers "home" – the same guard applies).
    await press('header-home-back');
    expect(await screen.findByTestId('sign-up-step-role', {}, TIMEOUT)).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/auth/sign-up');
    await press('sign-up-continue');
    await screen.findByTestId('sign-up-step-account', {}, TIMEOUT);

    // A registered email comes back as a field error from the server.
    await fillCustomerAccount('noa.levi@example.com');
    await press('sign-up-continue');
    expect(await screen.findByText('An account with this email already exists', {}, TIMEOUT)).toBeOnTheScreen();

    await type('sign-up-email', uniqueEmail('tamar'));
    await press('sign-up-continue');
    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), TIMEOUT);
    expect(sessionStore.getState()).toMatchObject({ status: 'signedIn', role: 'customer' });
  });

  it('offers to sign in with an email that already has an account', async () => {
    const app = await renderApp('/auth/sign-up?role=customer');
    await screen.findByTestId('sign-up-step-account', {}, TIMEOUT);
    expect(screen.queryByTestId('sign-up-sign-in-instead')).toBeNull();

    await fillCustomerAccount('Noa.Levi@example.com');
    await press('sign-up-continue');
    expect(await screen.findByText('An account with this email already exists', {}, TIMEOUT)).toBeOnTheScreen();

    // Right under the error: sign in instead, with the email carried over (in memory, not the URL).
    await press('sign-up-sign-in-instead');
    await waitFor(() => expect(app.getPathname()).toBe('/auth/login'), TIMEOUT);
    await waitFor(() => expect(screen.getByTestId('login-email').props.value).toBe('Noa.Levi@example.com'), TIMEOUT);
    expect(screen.getByTestId('login-password').props.value).toBe('');

    // "Forgot password?" carries the typed email the same way.
    await press('login-forgot-password');
    await waitFor(() => expect(app.getPathname()).toBe('/auth/forgot-password'), TIMEOUT);
    await waitFor(() => expect(screen.getByTestId('forgot-password-email').props.value).toBe('Noa.Levi@example.com'), TIMEOUT);
  });

  it('creates a professional account with services and a service area', async () => {
    const app = await renderApp('/auth/sign-up?role=professional');
    // The role came with the link: the flow starts on the account step, counted as step 1 of 3.
    expect(await screen.findByTestId('sign-up-progress', {}, TIMEOUT)).toHaveTextContent('Step 1 of 3');
    expect(screen.getByTestId('sign-up-step-account')).toBeOnTheScreen();
    await fillCustomerAccount(uniqueEmail('yossi'));
    await press('sign-up-continue');

    // Step 3: at least one service.
    expect(await screen.findByTestId('sign-up-step-services', {}, TIMEOUT)).toBeOnTheScreen();
    await press('sign-up-continue');
    expect(await screen.findByText('Choose at least one service category')).toBeOnTheScreen();
    await type('sign-up-business-name', 'Tamar Fix');
    await press('category-option-plumbing');
    await press('category-option-handyman');
    await waitFor(() => expect(screen.queryByText('Choose at least one service category')).toBeNull());
    await press('sign-up-continue');

    // Step 4: the base address is required; the radius defaults to 20 km.
    expect(await screen.findByTestId('sign-up-step-area', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.getByTestId('sign-up-radius-20')).toBeChecked();
    await press('sign-up-continue');
    expect(await screen.findByText('Choose the address you work from')).toBeOnTheScreen();

    // Suggestions show while the search field is focused.
    await fireEvent(screen.getByTestId('location-search'), 'focus');
    await type('location-search', 'Florentin');
    const suggestions = await screen.findAllByRole('button', { name: /^Florentin St,/ }, TIMEOUT);
    await fireEvent.press(suggestions[0]);
    // A tap on the map fine-tunes the base location (the address is looked up again).
    const tapped = { latitude: 32.0571, longitude: 34.7694 };
    const map = getMapWebView();
    await emitMapMessage(map, { type: 'ready' });
    await emitMapMessage(map, { type: 'mapPress', coordinate: tapped });
    await waitFor(() => expect(screen.queryByText('Looking up the address…')).toBeNull(), TIMEOUT);
    await press('sign-up-radius-10');
    await press('sign-up-continue');

    await waitFor(() => expect(app.getPathname()).toBe('/professional/home'), TIMEOUT);
    const session = sessionStore.getState();
    expect(session).toMatchObject({ status: 'signedIn', role: 'professional' });
    const profile = await env.as(session.userId).professionals.getOwnProfessionalProfile();
    expect(profile.serviceArea).toMatchObject({ center: tapped, radiusKm: 10 });
  });
});

describe('Continue with Google (demo)', () => {
  it('signs in an existing account and continues sign-up for a new identity', async () => {
    const app = await renderApp('/auth/login');
    await screen.findByTestId('login-google', {}, TIMEOUT);
    await press('login-google');
    const sheet = await screen.findByTestId('google-demo-sheet', {}, TIMEOUT);
    expect(within(sheet).getByText('Continue with Google (demo)')).toBeOnTheScreen();

    // A new identity: the sign-up flow continues with the name and a locked email, no password.
    await press('google-demo-account-maya-katz');
    await waitFor(() => expect(app.getPathname()).toBe('/auth/sign-up'), TIMEOUT);
    // Already on the role step it says the Google account was picked up.
    expect(await screen.findByTestId('sign-up-google-identity', {}, TIMEOUT)).toHaveTextContent(/maya\.katz@gmail\.com/);
    await press('sign-up-role-customer');
    await press('sign-up-continue');
    expect(await screen.findByTestId('sign-up-google-identity', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.getByTestId('sign-up-first-name').props.value).toBe('Maya');
    expect(screen.getByTestId('sign-up-email').props.value).toBe('maya.katz@gmail.com');
    expect(screen.getByTestId('sign-up-email').props.editable).toBe(false);
    expect(screen.queryByTestId('sign-up-password')).toBeNull();

    await press('sign-up-continue');
    expect(await screen.findByText('Enter a phone number')).toBeOnTheScreen();
    await type('sign-up-phone', '0501112233');
    await press('sign-up-terms');
    await press('sign-up-continue');
    await waitFor(() => expect(app.getPathname()).toBe('/customer/home'), TIMEOUT);
    expect(pendingGoogleSignUpStore.get()).toBeNull();
  });

  it('signs a demo account straight in', async () => {
    const app = await renderApp('/auth/login');
    await screen.findByTestId('login-google', {}, TIMEOUT);
    await press('login-google');
    await screen.findByTestId('google-demo-sheet', {}, TIMEOUT);
    await press('google-demo-account-avi-mizrahi');
    await waitFor(() => expect(app.getPathname()).toBe('/professional/home'), TIMEOUT);
  });
});
