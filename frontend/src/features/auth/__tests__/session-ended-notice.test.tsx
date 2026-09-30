/**
 * The notice of a session the server ended: shown once, on the entry screen (after the sign-out),
 * never for a sign-out on purpose and never again for a later session.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { ToastProvider } from '@/components/ui';
import { i18n, initI18n } from '@/i18n';
import { sessionEnded } from '@/services/auth/session-ended';
import { sessionStore } from '@/services/auth/session-store';
import type { AuthSession } from '@/types/api';

import { SessionEndedNotice } from '../session-ended-notice';

const TITLE = 'You’ve been signed out';

function session(userId: string): AuthSession {
  return {
    accessToken: `access-${userId}`,
    accessTokenExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    refreshToken: `refresh-${userId}`,
    user: { id: userId, role: 'customer' } as AuthSession['user'],
  };
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

async function renderNotice() {
  await renderWithProviders(
    <ToastProvider>
      <SessionEndedNotice />
    </ToastProvider>,
  );
}

beforeAll(async () => {
  await initI18n('en');
});

beforeEach(async () => {
  await sessionStore.signOut();
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('SessionEndedNotice', () => {
  it('explains a sign-out the server caused', async () => {
    await sessionStore.signIn(session('u1'));
    await renderNotice();
    await act(async () => {
      await sessionStore.signOut();
      sessionEnded.notify();
    });
    await settle();
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(screen.getByText('Your session has ended. Please sign in again.')).toBeOnTheScreen();
  });

  it('says nothing for a sign-out on purpose', async () => {
    await sessionStore.signIn(session('u2'));
    await renderNotice();
    await act(async () => {
      await sessionStore.signOut();
    });
    await settle();
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('is not shown again when a later session is signed out on purpose', async () => {
    await sessionStore.signIn(session('u3'));
    await renderNotice();
    await act(async () => {
      await sessionStore.signOut();
      sessionEnded.notify();
    });
    await settle();
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('common:a11y.dismiss') }));
    await settle();
    expect(screen.queryByText(TITLE)).toBeNull();

    await act(async () => {
      await sessionStore.signIn(session('u4'));
    });
    await act(async () => {
      await sessionStore.signOut();
    });
    await settle();
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('speaks Hebrew', async () => {
    await i18n.changeLanguage('he');
    await sessionStore.signIn(session('u5'));
    await renderNotice();
    await act(async () => {
      await sessionStore.signOut();
      sessionEnded.notify();
    });
    await settle();
    expect(screen.getByText('התנתקתם מהחשבון')).toBeOnTheScreen();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });
});
