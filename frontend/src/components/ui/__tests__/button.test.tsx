import { fireEvent, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { renderWithProviders } from '../../__test-utils__/render';
import { Button } from '../button';
import { IconButton } from '../icon-button';

describe('Button', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('renders its label as an accessible button and handles presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Send offer" leftIcon="send" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Send offer' });
    expect(button).toBeEnabled();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Continue" disabled onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a busy state while loading and blocks presses', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Saving" loading onPress={onPress} variant="secondary" />);

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('IconButton is announced with its label', async () => {
    await renderWithProviders(<IconButton icon="plus" accessibilityLabel="New request" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'New request' })).toBeOnTheScreen();
  });
});
