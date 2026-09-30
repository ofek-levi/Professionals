/**
 * The customer's request status says who got the request: the number of pros notified, or that no
 * pro covers the service there yet (never a promise that is not backed by the server's count).
 */
import { act, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { i18n, initI18n } from '@/i18n';
import type { CustomerRequestView } from '@/types/domain';

import { RequestSummary } from '../request-summary';

jest.mock('@/services/api', () => ({
  api: { catalog: { getProfessionalCategories: () => new Promise(() => undefined) } },
}));

function openRequest(matchedProfessionalCount: number | null): CustomerRequestView {
  const at = new Date().toISOString();
  return {
    id: 'req_1',
    customerId: 'user_1',
    categoryId: 'locksmith',
    description: 'Locked out of the apartment',
    location: { coordinates: { latitude: 32.08, longitude: 34.78 }, addressLine: 'Dizengoff 50', city: 'Tel Aviv', neighborhood: null, details: null, isApproximate: false },
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
    matchedProfessionalCount,
  };
}

beforeAll(async () => {
  await initI18n('en');
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('RequestSummary (waiting for offers)', () => {
  it('says how many pros were notified', async () => {
    await renderWithProviders(<RequestSummary request={openRequest(3)} job={undefined} />);
    expect(screen.getByText(' · We’ve notified 3 pros nearby.')).toBeTruthy();
  });

  it('says so when no pro covers the service in the area yet', async () => {
    await renderWithProviders(<RequestSummary request={openRequest(0)} job={undefined} />);
    expect(screen.getByText(/No pros offer this service in your area yet/)).toBeTruthy();
    expect(screen.queryByText(/We’ve notified/)).toBeNull();
  });

  it('promises nothing while the count is not known yet', async () => {
    await renderWithProviders(<RequestSummary request={openRequest(null)} job={undefined} />);
    expect(screen.getByText('Waiting for offers')).toBeTruthy();
    expect(screen.queryByText(/notified|No pros/)).toBeNull();
  });

  it('uses the Hebrew plural forms', async () => {
    await i18n.changeLanguage('he');
    await renderWithProviders(<RequestSummary request={openRequest(2)} job={undefined} />);
    expect(screen.getByText(/שלחנו את הבקשה לשני אנשי מקצוע באזור./)).toBeTruthy();
    // Switching back re-renders the mounted tree, so it happens inside act().
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });
});
