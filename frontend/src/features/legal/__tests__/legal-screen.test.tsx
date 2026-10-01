/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * The legal documents with the real route tree (`src/app`) against the test double: open signed
 * out (entry screen, web deep link) and signed in (Settings → Legal), rendered from
 * `GET /legal/:document?lang=` (headings, lists, definitions, bold, links), loading and error states.
 */
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { act, cleanup, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { i18n } from '@/i18n';
import { queryClient } from '@/lib/query-client';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { Transport, TransportResponse } from '@/services/api/transport';
import { MAIN_CUSTOMER_IDS, PRO_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.setTimeout(30_000);

const TIMEOUT = { timeout: 10_000 };
let env: TestEnvironment;

beforeAll(() => {
  // `expo-router/testing-library` installs Reanimated's official mock, which lacks
  // `useReducedMotion` (used by skeletons).
  const reanimated = require('react-native-reanimated') as Record<string, unknown>;
  reanimated.useReducedMotion ??= () => false;

  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
});

afterEach(async () => {
  // Unmount first so signing out doesn't update a tree outside of `act`.
  await cleanup();
  apiClient.setTransport(env.transport);
  await sessionStore.signOut();
  queryClient.clear();
  env.log.clear();
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

function getRouter() {
  const { router } = require('expo-router') as typeof import('expo-router');
  return router;
}

const findDocument = () => screen.findByTestId('legal-document', {}, TIMEOUT);

/** The titles of the native stack headers (the one on top last). */
const headerTitles = () =>
  screen.container.queryAll((node) => node.type === 'RNSScreenStackHeaderConfig').map((node) => node.props.title as string);

describe('signed out', () => {
  it('opens the Privacy Policy by URL (web deep link) and renders it', async () => {
    const app = await renderApp('/legal/privacy');
    const document = await findDocument();
    // Not redirected to the entry screen.
    expect(app.getPathname()).toBe('/legal/privacy');

    // Asked in the app's language, without a session.
    const [request] = env.log.to('/legal/privacy', 'GET');
    expect(request.query).toEqual({ lang: 'en' });
    expect(request.headers.Authorization).toBeUndefined();

    // The title in the header, the effective date, the intro and the sections.
    expect(headerTitles()).toEqual(['Privacy Policy']);
    expect(within(document).getByTestId('legal-effective-date')).toHaveTextContent('Effective date: Sep 30, 2026');
    expect(within(document).getByText(/This policy explains how we handle personal data/)).toBeOnTheScreen();
    expect(within(document).getAllByRole('header')).toHaveLength(2);
    expect(within(document).getByRole('header', { name: 'Personal data we collect' })).toBeOnTheScreen();
    expect(within(document).getByRole('header', { name: 'Your rights' })).toBeOnTheScreen();

    // A bullet list with bold lead-ins.
    const section = within(document).getByTestId('legal-section-data-we-collect');
    expect(within(section).getByText(/your name, email, phone and role\./)).toBeOnTheScreen();
    expect(within(section).getByText('Account:')).toHaveStyle({ fontFamily: 'Rubik_500Medium' });

    // Links: a web page opens in the in-app browser, an email address in the mail app.
    const browse = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: WebBrowser.WebBrowserResultType.OPENED });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await fireEvent.press(within(document).getByRole('link', { name: 'Privacy Protection Authority' }));
    expect(browse).toHaveBeenCalledWith('https://www.gov.il/he/departments/the_privacy_protection_authority/govil-landing-page');
    await fireEvent.press(within(document).getByRole('link', { name: 'legal@example.com' }));
    expect(openURL).toHaveBeenCalledWith('mailto:legal@example.com');
  });

  it('opens both documents from the entry screen, and the other document from a link', async () => {
    const app = await renderApp('/sign-in');
    await fireEvent.press(await screen.findByTestId('entry-legal-terms', {}, TIMEOUT));
    await waitFor(() => expect(app.getPathname()).toBe('/legal/terms'), TIMEOUT);
    const terms = await findDocument();

    // Definitions and a list.
    const about = within(terms).getByTestId('legal-section-about-us');
    expect(within(about).getByText('Operator')).toBeOnTheScreen();
    expect(within(about).getByText('Example Services Ltd.')).toBeOnTheScreen();
    expect(within(terms).getByText('You must be 18 or older.')).toBeOnTheScreen();

    // The link to this document's own web page opens it in the browser (in the app's language), the
    // Privacy Policy in the app.
    const browse = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: WebBrowser.WebBrowserResultType.OPENED });
    await fireEvent.press(within(terms).getByRole('link', { name: 'http://localhost:4000/legal/terms' }));
    expect(browse).toHaveBeenCalledWith('http://localhost:4000/legal/terms?lang=en');
    await fireEvent.press(within(terms).getByRole('link', { name: 'Privacy Policy' }));
    await waitFor(() => expect(app.getPathname()).toBe('/legal/privacy'), TIMEOUT);
    await waitFor(() => expect(screen.getByTestId('legal-section-your-rights')).toBeOnTheScreen(), TIMEOUT);

    // Back to the terms, then to the entry screen.
    await act(async () => getRouter().back());
    await waitFor(() => expect(app.getPathname()).toBe('/legal/terms'), TIMEOUT);
    await act(async () => getRouter().back());
    await waitFor(() => expect(app.getPathname()).toBe('/sign-in'), TIMEOUT);
    await screen.findByTestId('entry-legal-privacy', {}, TIMEOUT);
  });

  it('reads the document in Hebrew, right to left', async () => {
    await i18n.changeLanguage('he');
    await renderApp('/legal/terms');
    const document = await findDocument();
    expect(env.log.to('/legal/terms', 'GET')[0].query).toEqual({ lang: 'he' });
    expect(headerTitles()).toEqual(['תנאי השימוש']);
    expect(within(document).getByTestId('legal-effective-date')).toHaveTextContent(/^בתוקף מיום 30 בספט/);
    // A Hebrew paragraph that starts with the (Latin) app name still runs right to left.
    expect(within(document).getByText('‏Professionals מופעלת על ידי:')).toBeOnTheScreen();
    expect(within(document).getByText('השימוש מותר רק מגיל 18.')).toBeOnTheScreen();

    // Its public page opens in Hebrew too, whatever the browser's language; without an in-app
    // browser (no Custom Tabs on Android), with the system's handler.
    const browse = jest.spyOn(WebBrowser, 'openBrowserAsync').mockRejectedValue(new Error('No browser'));
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await fireEvent.press(within(document).getByRole('link', { name: 'http://localhost:4000/legal/terms' }));
    expect(browse).toHaveBeenCalledWith('http://localhost:4000/legal/terms?lang=he');
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('http://localhost:4000/legal/terms?lang=he'), TIMEOUT);
  });

  it('offers a retry after an error', async () => {
    let failNext = true;
    let release: (() => void) | null = null;
    const transport: Transport = async (request) => {
      if (request.path.startsWith('/legal/')) {
        if (failNext) {
          failNext = false;
          // 429 without Retry-After: no automatic retry, the screen offers one.
          return { status: 429, data: { code: 'RATE_LIMITED', message: 'Too many requests' } } satisfies TransportResponse;
        }
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return env.transport(request);
    };
    apiClient.setTransport(transport);

    await renderApp('/legal/terms');
    expect(await screen.findByText('Try again', {}, TIMEOUT)).toBeOnTheScreen();
    expect(screen.queryByTestId('legal-document')).toBeNull();

    await fireEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(release).not.toBeNull(), TIMEOUT);
    await act(async () => release?.());
    await findDocument();
  });

  it('shows the loading skeleton until the document arrives', async () => {
    let release: (() => void) | null = null;
    apiClient.setTransport(async (request) => {
      if (request.path.startsWith('/legal/')) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return env.transport(request);
    });
    await renderApp('/legal/privacy');
    expect(await screen.findByTestId('legal-loading', {}, TIMEOUT)).toBeOnTheScreen();
    await waitFor(() => expect(release).not.toBeNull(), TIMEOUT);
    await act(async () => release?.());
    await findDocument();
    expect(screen.queryByTestId('legal-loading')).toBeNull();
  });

  it('answers an unknown document with "not found" and asks nothing', async () => {
    const app = await renderApp('/legal/cookies');
    expect(await screen.findByText('Not found', {}, TIMEOUT)).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/legal/cookies');
    expect(env.log.requests.filter((request) => request.path.startsWith('/legal/'))).toEqual([]);
  });
});

describe('signed in', () => {
  it('opens both documents from Settings → Legal', async () => {
    await sessionStore.signIn(env.signIn(MAIN_CUSTOMER_IDS.noa));
    const app = await renderApp('/settings');
    const legal = await screen.findByTestId('settings-legal', {}, TIMEOUT);
    expect(within(legal).getByText('Legal')).toBeOnTheScreen();
    expect(within(legal).getByTestId('settings-legal-terms')).toHaveTextContent(/^Terms of Use/);
    expect(within(legal).getByTestId('settings-legal-privacy')).toHaveTextContent(/^Privacy Policy/);

    await fireEvent.press(within(legal).getByTestId('settings-legal-terms'));
    await waitFor(() => expect(app.getPathname()).toBe('/legal/terms'), TIMEOUT);
    await findDocument();
    expect(headerTitles()).toEqual(['Settings', 'Terms of Use']);
    await act(async () => getRouter().back());
    await waitFor(() => expect(app.getPathname()).toBe('/settings'), TIMEOUT);

    await fireEvent.press(await screen.findByTestId('settings-legal-privacy', {}, TIMEOUT));
    await waitFor(() => expect(app.getPathname()).toBe('/legal/privacy'), TIMEOUT);
    await findDocument();
  });

  it('opens a document by URL without leaving it for the home tab', async () => {
    await sessionStore.signIn(env.signIn(PRO_IDS.avi));
    const app = await renderApp('/legal/privacy');
    await findDocument();
    expect(app.getPathname()).toBe('/legal/privacy');
    // Nothing to go back to: the header offers the way home.
    await fireEvent.press(screen.getByTestId('header-home-back'));
    await waitFor(() => expect(app.getPathname()).toBe('/professional/home'), TIMEOUT);
  });
});
