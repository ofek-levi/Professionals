/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import type { CustomerRequestView, ProfessionalRequestView, ServiceRequest } from '@/types/domain';

import { renderWithProviders } from '../../__test-utils__/render';
import { RequestCard } from '../request-card';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// Components read the catalog through React Query; keep the bundled catalog (never resolve).
jest.mock('@/services/api', () => ({
  api: { catalog: { getProfessionalCategories: () => new Promise(() => undefined) } },
}));

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const baseRequest: ServiceRequest = {
  id: 'req-1',
  customerId: 'cust-1',
  categoryId: 'plumbing',
  description: 'The kitchen sink is leaking under the cabinet and the floor gets wet every morning.',
  location: {
    coordinates: { latitude: 32.06, longitude: 34.77 },
    addressLine: 'Florentin St 12',
    city: 'Tel Aviv-Yafo',
    neighborhood: 'Florentin',
    details: null,
    isApproximate: false,
  },
  urgency: 'urgent',
  preferredSchedule: null,
  photos: [],
  notes: null,
  status: 'offers_received',
  offerCount: 3,
  pendingOfferCount: 3,
  acceptedOfferId: null,
  jobId: null,
  publishedAt: minutesAgo(5),
  cancelledAt: null,
  cancellationReason: null,
  cancellationComment: null,
  createdAt: minutesAgo(5),
  updatedAt: minutesAgo(1),
};

const customerRequest: CustomerRequestView = {
  ...baseRequest,
  latestOfferAt: minutesAgo(1),
  lowestOfferPrice: 250,
  matchedProfessionalCount: 3,
};

const professionalRequest: ProfessionalRequestView = {
  ...baseRequest,
  location: { ...baseRequest.location, addressLine: '', isApproximate: true },
  distanceKm: 2.42,
  customer: {
    id: 'cust-1',
    displayName: 'Dana L.',
    avatarUrl: null,
    city: 'Tel Aviv-Yafo',
    memberSince: minutesAgo(60 * 24 * 90),
    completedJobsCount: 4,
  },
  myOffer: { offerId: 'off-1', status: 'pending', price: 320, currency: 'ILS', proposedStartAt: minutesAgo(-60 * 24) },
  isMatch: true,
};

describe('RequestCard', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('shows the compact customer view: category, one-line description and one status line', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<RequestCard variant="customer" request={customerRequest} hasNewOffers onPress={onPress} />);

    expect(screen.getByText('Plumbing')).toBeOnTheScreen();
    expect(screen.getByText(customerRequest.description)).toBeOnTheScreen();
    expect(screen.getByText('3 offers to review')).toBeOnTheScreen();
    expect(screen.getByTestId('request-card-new')).toBeOnTheScreen();
    // No location, urgency, photo counts or prices on the list card.
    expect(screen.queryByText('Florentin, Tel Aviv-Yafo')).not.toBeOnTheScreen();
    expect(screen.queryByText('Urgent')).not.toBeOnTheScreen();
    expect(screen.queryByText('From ₪250')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says what the request is waiting for', async () => {
    await renderWithProviders(
      <RequestCard variant="customer" request={{ ...customerRequest, offerCount: 0, pendingOfferCount: 0, status: 'open', lowestOfferPrice: null }} />,
    );
    expect(screen.getByText('Waiting for offers')).toBeOnTheScreen();
    expect(screen.queryByTestId('request-card-new')).not.toBeOnTheScreen();
  });

  it('shows the booked appointment and accepts a custom status line', async () => {
    const booked = { ...customerRequest, status: 'scheduled' as const, pendingOfferCount: 0 };
    const { rerender } = await renderWithProviders(<RequestCard variant="customer" request={booked} />);
    expect(screen.getByText('Booked')).toBeOnTheScreen();

    await rerender(<RequestCard variant="customer" request={booked} statusLine={{ label: 'Rate CoolAir HVAC', tone: 'warning' }} />);
    expect(screen.getByText('Rate CoolAir HVAC')).toBeOnTheScreen();
  });

  it('shows the compact professional view: urgency, distance · posted and the Offered pill', async () => {
    await renderWithProviders(<RequestCard variant="professional" request={professionalRequest} />);

    expect(screen.getByText('Plumbing')).toBeOnTheScreen();
    expect(screen.getByText('Urgent')).toBeOnTheScreen();
    expect(screen.getByText('2.4 km · 5 minutes ago')).toBeOnTheScreen();
    expect(screen.getByText('Offered')).toBeOnTheScreen();
    expect(screen.queryByText('3 offers to review')).not.toBeOnTheScreen();
  });

  it('shows no pill before the professional sends an offer, and no urgency pill for normal requests', async () => {
    await renderWithProviders(<RequestCard variant="professional" request={{ ...professionalRequest, urgency: 'normal', myOffer: null }} />);
    expect(screen.queryByTestId('request-card-offered')).not.toBeOnTheScreen();
    expect(screen.queryByText('Normal')).not.toBeOnTheScreen();
  });
});
