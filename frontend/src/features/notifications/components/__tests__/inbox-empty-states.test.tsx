/** A new account's inbox says what will appear in Updates and when a chat opens, per role. */
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { ConversationList } from '@/features/messaging/components/conversation-list';
import { initI18n } from '@/i18n';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { TransportRequest } from '@/services/api/transport';
import { MAIN_CUSTOMER_IDS, PRO_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { UpdatesList } from '../updates-list';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: jest.fn() }));

let env: TestEnvironment;
const EMPTY_PAGE = { items: [], nextCursor: null, totalCount: 0 };

beforeAll(async () => {
  await initI18n('en');
  env = createTestEnvironment({ now: new Date() });
  // A brand-new account: nothing in the inbox yet.
  apiClient.setTransport((request: TransportRequest) =>
    request.method === 'GET' && (request.path === '/notifications' || request.path === '/conversations')
      ? Promise.resolve({ status: 200, data: EMPTY_PAGE, headers: {} })
      : env.transport(request),
  );
});

afterEach(async () => {
  await sessionStore.signOut();
});

describe('inbox empty states', () => {
  it('tells a customer what Updates will show and that a chat opens after accepting an offer', async () => {
    await sessionStore.signIn(env.signIn(MAIN_CUSTOMER_IDS.noa));
    await renderWithProviders(<UpdatesList />);
    expect(await screen.findByText('Offers on your requests, job reminders and reviews will show up here.')).toBeOnTheScreen();
    await renderWithProviders(<ConversationList />);
    expect(await screen.findByText('A chat with the pro opens when you accept an offer.')).toBeOnTheScreen();
  });

  it('tells a pro the same from their side', async () => {
    await sessionStore.signIn(env.signIn(PRO_IDS.avi));
    await renderWithProviders(<UpdatesList />);
    expect(await screen.findByText('New jobs near you, answers to your offers and job reminders will show up here.')).toBeOnTheScreen();
    await renderWithProviders(<ConversationList />);
    expect(await screen.findByText('A chat with the customer opens when they accept your offer.')).toBeOnTheScreen();
  });
});
