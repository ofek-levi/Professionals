import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';
import type { OfferWithProfessional } from '@/types/domain';

import { OfferCard } from '../offer-card';

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

  it('shows who, the price, the proposed time and the message, and accepts on press', async () => {
    const onAccept = jest.fn();
    const onOpenProfessional = jest.fn();
    await renderWithProviders(
      <OfferCard
        offer={offer('a')}
        now={NOW}
        canAccept
        accepting={false}
        disabled={false}
        onAccept={onAccept}
        onOpenProfessional={onOpenProfessional}
      />,
    );

    expect(screen.getByText('Pro A')).toBeOnTheScreen();
    expect(screen.getByText('₪450')).toBeOnTheScreen();
    expect(screen.getByText('Tomorrow at 12:00')).toBeOnTheScreen();
    expect(screen.getByText('I can come tomorrow morning with all the parts.')).toBeOnTheScreen();
    // No highlight badges, expiry countdowns or extra facts.
    expect(screen.queryByText(/Expires/)).not.toBeOnTheScreen();
    expect(screen.queryByText('Lowest price')).not.toBeOnTheScreen();
    expect(screen.queryByText('41 jobs completed')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('offer-accept-a'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('offer-pro-a'));
    expect(onOpenProfessional).toHaveBeenCalledTimes(1);
  });

  it('hides Accept when the offer can no longer be accepted and skips an empty message', async () => {
    await renderWithProviders(
      <OfferCard
        offer={offer('b', { message: '  ' })}
        now={NOW}
        canAccept={false}
        accepting={false}
        disabled={false}
        onAccept={jest.fn()}
        onOpenProfessional={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('offer-accept-b')).not.toBeOnTheScreen();
    expect(screen.getByText('View profile')).toBeOnTheScreen();
  });
});
