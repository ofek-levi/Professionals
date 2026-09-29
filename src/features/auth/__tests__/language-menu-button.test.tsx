import { act, fireEvent, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { i18n, initI18n } from '@/i18n';

import { LanguageMenuButton } from '../components/language-menu-button';

const mockChangeLanguage = jest.fn(async () => true);
jest.mock('@/features/settings/use-change-language', () => ({ useChangeLanguage: () => mockChangeLanguage }));

beforeAll(async () => {
  await initI18n();
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  mockChangeLanguage.mockClear();
  // The sheet reports that it has closed after its exit animation (see sheet.test.tsx).
  jest.replaceProperty(Platform, 'OS', 'android');
});

describe('LanguageMenuButton', () => {
  it('shows the current language and lists every language in its own script', async () => {
    await renderWithProviders(<LanguageMenuButton />);
    const button = screen.getByRole('button', { name: 'Language: English' });
    expect(button).toHaveTextContent(/English/);

    await act(() => fireEvent.press(button));
    expect(screen.getByText('Choose language')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'English', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'עברית', checked: false })).toBeOnTheScreen();
  });

  it('applies the chosen language once the sheet has closed', async () => {
    await renderWithProviders(<LanguageMenuButton />);
    await act(() => fireEvent.press(screen.getByTestId('language-menu')));
    await act(() => fireEvent.press(screen.getByTestId('language-menu-he')));

    // A restart confirmation (phones, English ⇄ Hebrew) must not open over a sheet that is still closing.
    expect(mockChangeLanguage).toHaveBeenCalledTimes(1);
    expect(mockChangeLanguage).toHaveBeenCalledWith('he');
    expect(screen.queryByText('Choose language')).toBeNull();
  });

  it('only closes the sheet when the current language is picked', async () => {
    await renderWithProviders(<LanguageMenuButton />);
    await act(() => fireEvent.press(screen.getByTestId('language-menu')));
    await act(() => fireEvent.press(screen.getByTestId('language-menu-en')));

    expect(mockChangeLanguage).not.toHaveBeenCalled();
    expect(screen.queryByText('Choose language')).toBeNull();
  });
});
