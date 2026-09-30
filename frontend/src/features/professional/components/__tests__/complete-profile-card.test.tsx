/** Pro Home: a new professional is told what the public profile still lacks, and where to add it. */
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { i18n, initI18n } from '@/i18n';
import { routes } from '@/lib/routes';

import { CompleteProfileCard } from '../complete-profile-card';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeAll(async () => {
  await initI18n('en');
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('CompleteProfileCard', () => {
  it('lists the missing parts and opens the profile form', async () => {
    await renderWithProviders(<CompleteProfileCard gaps={['photo', 'bio']} />);
    expect(screen.getByText('Complete your profile')).toBeTruthy();
    expect(screen.getByText(/Still missing: photo · about you\./)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pro-home-complete-profile-action'));
    expect(mockPush).toHaveBeenCalledWith(routes.editProfile);
  });

  it('is hidden once the profile is complete', async () => {
    await renderWithProviders(<CompleteProfileCard gaps={[]} />);
    expect(screen.queryByTestId('pro-home-complete-profile')).toBeNull();
  });

  it('speaks Hebrew', async () => {
    await i18n.changeLanguage('he');
    await renderWithProviders(<CompleteProfileCard gaps={['headline']} />);
    expect(screen.getByText(/עדיין חסר: כותרת\./)).toBeTruthy();
  });
});
