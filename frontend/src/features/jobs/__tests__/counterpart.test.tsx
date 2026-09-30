/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The other party of a job with the real route tree (`src/app`) against the test double: a hired
 * professional's contact details (job details, their profile with the license number) reach only
 * the customer who hired them; someone who deleted their account shows as "Deleted user", without
 * a profile link, and their chat says why it is closed.
 */
import { Linking } from 'react-native';
import { cleanup, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '@/test-utils/mock-backend/data/seed';
import { SEED_PASSWORD } from '@/test-utils/mock-backend/server/passwords';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.setTimeout(30_000);

const TIMEOUT = { timeout: 10_000 };
const NOA = MAIN_CUSTOMER_IDS.noa;
const YAEL = PRO_IDS.yael;
/** Noa hired Yael (BrightSpark Electric) for the lighting job, awaiting her confirmation. */
const JOB = SEED_IDS.jobs.noaLighting;
let env: TestEnvironment;

beforeAll(() => {
  // `expo-router/testing-library` installs Reanimated's official mock, which lacks
  // `useReducedMotion` (used by skeletons).
  const reanimated = require('react-native-reanimated') as Record<string, unknown>;
  reanimated.useReducedMotion ??= () => false;
});

beforeEach(() => {
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

async function renderAs(userId: string, initialUrl: string) {
  await sessionStore.signIn(env.signIn(userId));
  const result = renderRouter('./src/app', { initialUrl });
  await result;
  return { getPathname: () => result.getPathname() };
}

/** The titles of the native stack headers (the one on top last). */
const headerTitles = () =>
  screen.container.queryAll((node) => node.type === 'RNSScreenStackHeaderConfig').map((node) => node.props.title as string);

describe('a hired professional’s contact details', () => {
  it('shows them on the job and opens the phone and the mail app', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderAs(NOA, `/jobs/${JOB}`);
    const contact = await screen.findByTestId('job-pro-contact', {}, TIMEOUT);
    expect(within(contact).getByText('Contact details')).toBeOnTheScreen();
    expect(within(contact).getByText('054-620-1188')).toBeOnTheScreen();
    expect(within(contact).getByText('yael@brightspark.example.com')).toBeOnTheScreen();
    // No website on this profile: no row for it.
    expect(within(contact).queryByTestId('job-pro-contact-website')).toBeNull();

    await fireEvent.press(within(contact).getByRole('link', { name: 'Call 054-620-1188' }));
    expect(openURL).toHaveBeenCalledWith('tel:0546201188');
    await fireEvent.press(within(contact).getByRole('link', { name: 'Email yael@brightspark.example.com' }));
    expect(openURL).toHaveBeenCalledWith('mailto:yael@brightspark.example.com');
  });

  it('offers a call from the hired professional’s card on the request', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderAs(NOA, `/requests/${SEED_IDS.requests.noaLighting}`);
    await fireEvent.press(await screen.findByTestId('hired-pro-call', {}, TIMEOUT));
    expect(openURL).toHaveBeenCalledWith('tel:0546201188');
  });

  it('shows them on the profile to the customer who hired them, with the license number', async () => {
    await renderAs(NOA, `/professionals/${YAEL}`);
    expect(await screen.findByTestId('profile-contact', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.getByText(/Licensed · No\. .*58213/)).toBeOnTheScreen();
  });

  it('keeps them from a customer who did not hire the professional', async () => {
    await renderAs(MAIN_CUSTOMER_IDS.daniel, `/professionals/${YAEL}`);
    await screen.findByTestId('profile-area-hours', {}, TIMEOUT);
    expect(screen.queryByTestId('profile-contact')).toBeNull();
    // The license number is public (self-declared).
    expect(screen.getByText(/Licensed · No\. .*58213/)).toBeOnTheScreen();
  });
});

describe('a deleted account', () => {
  it('shows the deleted professional as "Deleted user", without a profile or contact details', async () => {
    await env.as(YAEL).users.deleteAccount({ password: SEED_PASSWORD });
    const app = await renderAs(NOA, `/jobs/${JOB}`);
    const counterpart = await screen.findByTestId('job-counterpart', {}, TIMEOUT);
    expect(within(counterpart).getByText('Deleted user')).toBeOnTheScreen();
    expect(within(counterpart).queryByText('BrightSpark Electric')).toBeNull();
    // Not a link: its profile is gone.
    expect(counterpart.props.accessibilityRole).toBeUndefined();
    await fireEvent.press(counterpart);
    expect(app.getPathname()).toBe(`/jobs/${JOB}`);
    expect(screen.queryByTestId('job-pro-contact')).toBeNull();
    expect(env.log.to(`/professionals/${YAEL}`, 'GET')).toEqual([]);
  });

  it('says why the request of a deleted professional was cancelled', async () => {
    await env.as(YAEL).users.deleteAccount({ password: SEED_PASSWORD });
    await renderAs(NOA, `/requests/${SEED_IDS.requests.noaLighting}`);
    expect(await screen.findByText(/The account was deleted/, {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.queryByTestId('hired-pro-call')).toBeNull();
  });

  it('closes the chat with a deleted counterpart and says why', async () => {
    await env.as(YAEL).users.deleteAccount({ password: SEED_PASSWORD });
    await renderAs(NOA, `/conversations/${SEED_IDS.conversations.noaLighting}`);
    expect(await screen.findByTestId('chat-closed', {}, TIMEOUT)).toHaveTextContent(
      'This chat is closed because the other person deleted their account.',
    );
    await waitFor(() => expect(headerTitles()).toEqual(['Deleted user']), TIMEOUT);
  });

  it('shows a deleted customer to the professional in the app’s language', async () => {
    await env.as(NOA).users.deleteAccount({ password: SEED_PASSWORD });
    await i18n.changeLanguage('he');
    await renderAs(YAEL, `/jobs/${JOB}`);
    const counterpart = await screen.findByTestId('job-counterpart', {}, TIMEOUT);
    expect(within(counterpart).getByText('משתמש שנמחק')).toBeOnTheScreen();
  });
});
