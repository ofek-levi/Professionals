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

  it('shows the customer view: category, status, urgency, location, offers and new-offer highlight', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<RequestCard variant="customer" request={customerRequest} hasNewOffers onPress={onPress} />);

    expect(screen.getByText('Plumbing')).toBeOnTheScreen();
    expect(screen.getByText(customerRequest.description)).toBeOnTheScreen();
    expect(screen.getByText('Offers received')).toBeOnTheScreen();
    expect(screen.getByText('Urgent')).toBeOnTheScreen();
    expect(screen.getByText('Florentin, Tel Aviv-Yafo')).toBeOnTheScreen();
    expect(screen.getByText('3 offers')).toBeOnTheScreen();
    expect(screen.getByText('From ₪250')).toBeOnTheScreen();
    expect(screen.getByText('New offers')).toBeOnTheScreen();
    expect(screen.getByText('5 minutes ago')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the professional view: distance and the professional’s own offer', async () => {
    await renderWithProviders(<RequestCard variant="professional" request={professionalRequest} />);

    expect(screen.getByText('Plumbing')).toBeOnTheScreen();
    expect(screen.getByText('2.4 km away')).toBeOnTheScreen();
    expect(screen.getByText('Your offer')).toBeOnTheScreen();
    expect(screen.getByText('₪320')).toBeOnTheScreen();
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.queryByText('Offers received')).not.toBeOnTheScreen();
  });

  it('says when there are no offers yet', async () => {
    await renderWithProviders(
      <RequestCard variant="customer" request={{ ...customerRequest, offerCount: 0, pendingOfferCount: 0, status: 'open', lowestOfferPrice: null }} />,
    );
    expect(screen.getByText('No offers yet')).toBeOnTheScreen();
    expect(screen.getByText('Awaiting offers')).toBeOnTheScreen();
  });
});
