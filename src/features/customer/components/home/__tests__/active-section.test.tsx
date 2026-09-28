import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';
import type { CustomerRequestView, JobSummary } from '@/types/domain';

import type { HomeActiveRow } from '../../../customer-home-model';
import { ActiveSection } from '../active-section';

// Components read the catalog through React Query; keep the bundled catalog (never resolve).
jest.mock('@/services/api', () => ({
  api: { catalog: { getProfessionalCategories: () => new Promise(() => undefined) } },
}));

const request = (overrides: Partial<CustomerRequestView>): CustomerRequestView =>
  ({ id: 'req_1', categoryId: 'plumbing', status: 'open', pendingOfferCount: 0, ...overrides }) as CustomerRequestView;

const reviewJob = { id: 'job_1', categoryId: 'appliance_repair', professional: { displayName: 'CoolAir HVAC' } } as JobSummary;

describe('ActiveSection', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('shows one compact row per item with its status and opens it', async () => {
    const onOpenRow = jest.fn();
    const rows: HomeActiveRow[] = [
      { kind: 'request', request: request({ id: 'req_offers', status: 'offers_received', pendingOfferCount: 3 }), appointmentAt: null },
      { kind: 'review', job: reviewJob },
      { kind: 'request', request: request({ id: 'req_waiting', categoryId: 'electrical' }), appointmentAt: null },
    ];
    await renderWithProviders(<ActiveSection rows={rows} onOpenRow={onOpenRow} />);

    expect(screen.getByText('Active')).toBeOnTheScreen();
    expect(screen.getByText('3 offers to review')).toBeOnTheScreen();
    expect(screen.getByText(/Rate .*CoolAir HVAC/)).toBeOnTheScreen();
    expect(screen.getByText('Waiting for offers')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('home-rate-job_1'));
    expect(onOpenRow).toHaveBeenCalledWith(rows[1]);
  });

  it('says so in one line when nothing is active', async () => {
    await renderWithProviders(<ActiveSection rows={[]} onOpenRow={jest.fn()} />);
    expect(screen.getByTestId('home-active-empty')).toHaveTextContent('Nothing active right now', { exact: false });
  });
});
