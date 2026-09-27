import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';

import { JobTimeline } from '../job-timeline';

const NOW = new Date(2026, 8, 27, 12, 0);
const iso = (day: number, hours: number, minutes = 0) => new Date(2026, 8, day, hours, minutes).toISOString();

const baseJob = {
  createdAt: iso(25, 9),
  confirmedAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  scheduledStartAt: iso(29, 10),
};

describe('JobTimeline', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('tells each role what the next step is', async () => {
    const { rerender } = await renderWithProviders(
      <JobTimeline job={{ ...baseJob, status: 'awaiting_confirmation' }} role="professional" now={NOW} />,
    );
    expect(screen.getByText('Offer accepted')).toBeOnTheScreen();
    expect(screen.getByText('Fri, Sep 25 at 09:00')).toBeOnTheScreen();
    expect(screen.getByText('Waiting for your confirmation')).toBeOnTheScreen();

    await rerender(<JobTimeline job={{ ...baseJob, status: 'awaiting_confirmation' }} role="customer" now={NOW} />);
    expect(screen.getByText('The professional will confirm shortly')).toBeOnTheScreen();

    await rerender(<JobTimeline job={{ ...baseJob, status: 'scheduled', confirmedAt: iso(25, 10) }} role="customer" now={NOW} />);
    expect(screen.getByText('Scheduled for Tue, Sep 29 at 10:00')).toBeOnTheScreen();
  });

  it('shows the cancellation as the final step', async () => {
    await renderWithProviders(
      <JobTimeline job={{ ...baseJob, status: 'cancelled', cancelledAt: iso(26, 8, 30) }} role="customer" now={NOW} />,
    );
    expect(screen.getByText('Cancelled')).toBeOnTheScreen();
    expect(screen.queryByText('In progress')).toBeNull();
    expect(screen.getByText('Yesterday at 08:30')).toBeOnTheScreen();
  });
});
