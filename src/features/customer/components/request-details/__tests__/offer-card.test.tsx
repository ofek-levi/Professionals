import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';
import type { OfferWithProfessional } from '@/types/domain';

import { OfferCard } from '../offer-card';
import { OffersCompareTable } from '../offers-compare-table';

// Components read the catalog through React Query; keep the bundled catalog (never resolve).
jest.mock('@/services/api', () => ({
  api: { catalog: { getProfessionalCategories: () => new Promise(() => undefined) } },
}));

const NOW = new Date(2026, 8, 27, 10, 0);
const inHours = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

function offer(id: string, overrides: Partial<OfferWithProfessional> = {}): OfferWithProfessional {
  return {
    id,
    requestId: 'req-1',
    professionalId: `pro-${id}`,
    price: 450,
    currency: 'ILS',
    proposedStartAt: inHours(26),
    estimatedDurationMinutes: 90,
    message: 'I can come tomorrow morning with all the parts.',
    status: 'pending',
    statusReason: null,
    expiresAt: inHours(20),
    createdAt: inHours(-1),
    updatedAt: inHours(-1),
    respondedAt: null,
    distanceKm: 3.2,
    ...overrides,
    professional: {
      id: `pro-${id}`,
      displayName: `Pro ${id.toUpperCase()}`,
      avatarUrl: null,
      headline: 'Licensed plumber',
      categoryIds: ['plumbing'],
      yearsOfExperience: 8,
      averageRating: 4.7,
      reviewCount: 23,
      completedJobsCount: 41,
      isVerified: true,
      city: 'Holon',
      ...overrides.professional,
    },
  };
}

describe('OfferCard', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('shows price, timing, credentials, highlights and accepts on press', async () => {
    const onAccept = jest.fn();
    const onOpenProfessional = jest.fn();
    await renderWithProviders(
      <OfferCard
        offer={offer('a')}
        highlights={['lowestPrice', 'topRated']}
        now={NOW}
        canAccept
        accepting={false}
        disabled={false}
        onAccept={onAccept}
        onOpenProfessional={onOpenProfessional}
      />,
    );

    expect(screen.getByText('₪450')).toBeOnTheScreen();
    expect(screen.getByText('Tomorrow at 12:00')).toBeOnTheScreen();
    expect(screen.getByText('About 1h 30m')).toBeOnTheScreen();
    expect(screen.getByText('Lowest price')).toBeOnTheScreen();
    expect(screen.getByText('Top rated')).toBeOnTheScreen();
    expect(screen.getByText('8 yrs experience')).toBeOnTheScreen();
    expect(screen.getByText('41 jobs completed')).toBeOnTheScreen();
    expect(screen.getByText('3.2 km away')).toBeOnTheScreen();
    expect(screen.getByText('Expires in 20 hours')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('offer-accept-a'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('offer-pro-a'));
    expect(onOpenProfessional).toHaveBeenCalledTimes(1);
  });

  it('explains non-pending offers from the customer’s point of view and hides Accept', async () => {
    await renderWithProviders(
      <OfferCard
        offer={offer('b', { status: 'rejected', statusReason: 'another_offer_accepted' })}
        highlights={['earliest']}
        now={NOW}
        canAccept={false}
        accepting={false}
        disabled={false}
        onAccept={jest.fn()}
        onOpenProfessional={jest.fn()}
      />,
    );

    expect(screen.getByText('Not selected')).toBeOnTheScreen();
    expect(screen.getByText('You chose another pro')).toBeOnTheScreen();
    expect(screen.queryByTestId('offer-accept-b')).not.toBeOnTheScreen();
    // Highlights only apply to offers still awaiting a decision.
    expect(screen.queryByText('Earliest')).not.toBeOnTheScreen();
  });

  it('marks the accepted offer as the customer’s choice', async () => {
    await renderWithProviders(
      <OfferCard
        offer={offer('c', { status: 'accepted', statusReason: 'accepted_by_customer' })}
        highlights={[]}
        now={NOW}
        canAccept={false}
        accepting={false}
        disabled={false}
        onAccept={jest.fn()}
        onOpenProfessional={jest.fn()}
      />,
    );
    expect(screen.getByText('You hired this pro')).toBeOnTheScreen();
    expect(screen.getByText('You accepted this offer')).toBeOnTheScreen();
  });
});

describe('OffersCompareTable', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('lists offers side by side and accepts from a column', async () => {
    const onAccept = jest.fn();
    const cheap = offer('a', { price: 300 });
    const early = offer('b', { price: 520, proposedStartAt: inHours(3) });
    await renderWithProviders(
      <OffersCompareTable
        offers={[cheap, early]}
        now={NOW}
        canAccept
        acceptingOfferId={null}
        onAccept={onAccept}
        onOpenProfessional={jest.fn()}
      />,
    );

    expect(screen.getByText('Pro A')).toBeOnTheScreen();
    expect(screen.getByText('Pro B')).toBeOnTheScreen();
    expect(screen.getByText('₪300')).toBeOnTheScreen();
    expect(screen.getByText('₪520')).toBeOnTheScreen();
    expect(screen.getByText('Best value in each row')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('compare-accept-b'));
    expect(onAccept).toHaveBeenCalledWith(early);
  });
});
