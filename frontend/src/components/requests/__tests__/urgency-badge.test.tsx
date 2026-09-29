import { screen } from '@testing-library/react-native';

import { i18n, initI18n } from '@/i18n';

import { renderWithProviders } from '../../__test-utils__/render';
import { UrgencyBadge } from '../status-badges';
import { OfferStatusBadge } from '../../offers/offer-status-badge';

describe('status badges', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  // Reset before each test (nothing is mounted yet, so no act() warnings).
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the localized urgency label', async () => {
    await renderWithProviders(<UrgencyBadge level="urgent" />);
    expect(screen.getByText('Urgent')).toBeOnTheScreen();
    expect(screen.getByTestId('urgency-badge-urgent')).toBeOnTheScreen();
  });

  it('renders Hebrew labels', async () => {
    await i18n.changeLanguage('he');
    await renderWithProviders(<UrgencyBadge level="emergency" />);
    expect(screen.getByText('חירום')).toBeOnTheScreen();
  });

  it('renders offer statuses', async () => {
    await renderWithProviders(<OfferStatusBadge status="rejected" />);
    expect(screen.getByText('Not selected')).toBeOnTheScreen();
  });
});
