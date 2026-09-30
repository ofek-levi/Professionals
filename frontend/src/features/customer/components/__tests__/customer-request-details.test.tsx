/**
 * Right after posting, the customer gets one confirmation (the banner) and one statement of who got
 * the request (the status line, from the server's count) – never the same sentence twice.
 */
import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';
import { apiClient } from '@/services/api';
import type { TransportRequest } from '@/services/api/transport';
import { sessionStore } from '@/services/auth/session-store';
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';
import type { CustomerRequestView } from '@/types/domain';

import { CustomerRequestDetails } from '../customer-request-details';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), useFocusEffect: jest.fn() }));

const REQUEST_ID = '6abcbe02b9888bd06f5dc8c5';
const EMPTY_PAGE = { items: [], nextCursor: null, totalCount: 0 };
let env: TestEnvironment;
let matched: number | null = 0;

function justPostedRequest(): CustomerRequestView {
  const at = new Date().toISOString();
  return {
    id: REQUEST_ID,
    customerId: MAIN_CUSTOMER_IDS.noa,
    categoryId: 'plumbing',
    description: 'The kitchen sink pipe is leaking under the cabinet.',
    location: { coordinates: { latitude: 32.0776, longitude: 34.7741 }, addressLine: 'Dizengoff Street 50', city: 'Tel Aviv-Yafo', neighborhood: 'Lev HaIr', details: null, isApproximate: false },
    urgency: 'urgent',
    preferredSchedule: null,
    photos: [],
    notes: null,
    status: 'open',
    offerCount: 0,
    pendingOfferCount: 0,
    acceptedOfferId: null,
    jobId: null,
    publishedAt: at,
    cancelledAt: null,
    cancellationReason: null,
    cancellationComment: null,
    createdAt: at,
    updatedAt: at,
    latestOfferAt: null,
    lowestOfferPrice: null,
    matchedProfessionalCount: matched,
  };
}

beforeAll(async () => {
  await initI18n('en');
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport((request: TransportRequest) => {
    if (request.method === 'GET' && request.path === `/requests/${REQUEST_ID}`) {
      return Promise.resolve({ status: 200, data: { viewerRole: 'customer', request: justPostedRequest() }, headers: {} });
    }
    if (request.method === 'GET' && request.path === `/requests/${REQUEST_ID}/offers`) {
      return Promise.resolve({ status: 200, data: EMPTY_PAGE, headers: {} });
    }
    return env.transport(request);
  });
});

beforeEach(async () => {
  await sessionStore.signIn(env.signIn(MAIN_CUSTOMER_IDS.noa));
});

afterEach(async () => {
  await sessionStore.signOut();
});

describe('CustomerRequestDetails right after posting', () => {
  it('confirms once and says only in the status line that no pro covers the area yet', async () => {
    matched = 0;
    await renderWithProviders(<CustomerRequestDetails requestId={REQUEST_ID} justPosted />);
    expect(await screen.findByText('You’re all set. We’ll let you know when offers arrive.')).toBeOnTheScreen();
    expect(screen.getAllByText(/No pros offer this service in your area yet/)).toHaveLength(1);
  });

  it('confirms once and gives the number of pros notified only in the status line', async () => {
    matched = 2;
    await renderWithProviders(<CustomerRequestDetails requestId={REQUEST_ID} justPosted />);
    expect(await screen.findByText('You’re all set. We’ll let you know when offers arrive.')).toBeOnTheScreen();
    expect(screen.getAllByText(/notified 2 pros/)).toHaveLength(1);
  });
});
