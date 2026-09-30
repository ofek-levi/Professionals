/**
 * A screen that throws while rendering shows the app's error screen with a retry (instead of a
 * white page on the web or a fatal error on native), in the app's language, without providers.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { i18n, initI18n } from '@/i18n';

import { AppErrorBoundary } from '../app-error-boundary';

beforeAll(async () => {
  await initI18n('en');
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('AppErrorBoundary', () => {
  it('explains the failure and retries', async () => {
    const retry = jest.fn(async () => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await render(<AppErrorBoundary error={new Error("Cannot read properties of undefined (reading 'tone')")} retry={retry} />);
      expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
      fireEvent.press(screen.getByTestId('app-error-retry'));
      expect(retry).toHaveBeenCalledTimes(1);

      await i18n.changeLanguage('he');
      await render(<AppErrorBoundary error={new Error('boom')} retry={retry} />);
      expect(screen.getByText('משהו השתבש')).toBeOnTheScreen();
    } finally {
      error.mockRestore();
    }
  });
});
