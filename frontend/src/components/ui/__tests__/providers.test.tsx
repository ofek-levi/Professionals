/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { useState } from 'react';

import { i18n, initI18n } from '@/i18n';
import { createTheme } from '@/theme';

import { renderWithProviders } from '../../__test-utils__/render';
import { AppText } from '../app-text';
import { Button } from '../button';
import { DialogProvider, shouldStackDialogActions, useConfirm } from '../dialog-provider';
import { useErrorToast } from '../states';
import { ToastProvider, useToast } from '../toast-provider';
import { ApiError } from '@/services/api/errors';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

function ConfirmHarness() {
  const confirm = useConfirm();
  const [result, setResult] = useState('none');
  return (
    <>
      <Button
        label="Cancel request"
        onPress={async () => {
          const confirmed = await confirm({ title: 'Cancel this request?', message: 'Pros will be notified.', destructive: true, confirmLabel: 'Yes, cancel' });
          setResult(confirmed ? 'confirmed' : 'dismissed');
        }}
      />
      <AppText>{`result:${result}`}</AppText>
    </>
  );
}

function ToastHarness({ onToastPress }: { onToastPress: () => void }) {
  const toast = useToast();
  return <Button label="Notify" onPress={() => toast.show({ title: 'New offer received', message: 'Tap to review', tone: 'brand', onPress: onToastPress })} />;
}

const i18nText = (key: 'errors:codes.OFFER_EXPIRED.title' | 'errors:codes.OFFER_EXPIRED.description') => i18n.t(key);

function ErrorToastHarness({ title }: { title?: string }) {
  const showError = useErrorToast();
  const error = new ApiError(409, { code: 'OFFER_EXPIRED', message: 'This offer has expired' });
  return <Button label="Fail" onPress={() => showError(error, title ? { title } : undefined)} />;
}

describe('DialogProvider', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('resolves true when confirmed', async () => {
    await renderWithProviders(
      <DialogProvider>
        <ConfirmHarness />
      </DialogProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel request' }));
    expect(await screen.findByText('Cancel this request?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, cancel' }));
    expect(await screen.findByText('result:confirmed')).toBeOnTheScreen();
    expect(screen.queryByText('Cancel this request?')).not.toBeOnTheScreen();
  });

  it('shows long labels in full, confirm first', async () => {
    function LongLabels() {
      const confirm = useConfirm();
      return <Button label="Open" onPress={() => void confirm({ title: 'Confirm the appointment?', confirmLabel: 'Confirm appointment' })} />;
    }
    await renderWithProviders(
      <DialogProvider>
        <LongLabels />
      </DialogProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    const actions = await screen.findByTestId('confirm-dialog-actions');
    const buttons = within(actions).getAllByRole('button');
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(['Confirm appointment', 'Cancel']);
  });

  it('resolves false when cancelled', async () => {
    await renderWithProviders(
      <DialogProvider>
        <ConfirmHarness />
      </DialogProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel request' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('result:dismissed')).toBeOnTheScreen();
  });
});

describe('shouldStackDialogActions', () => {
  const theme = createTheme('light', false);

  it('keeps short labels side by side', () => {
    expect(shouldStackDialogActions(['Cancel', 'Delete'], 390, theme)).toBe(false);
    expect(shouldStackDialogActions(['ביטול', 'אישור המועד'], 390, theme)).toBe(false);
  });

  it('stacks the buttons when a label would not fit half of the dialog', () => {
    expect(shouldStackDialogActions(['Cancel', 'Confirm appointment'], 390, theme)).toBe(true);
    // Narrow phones stack earlier; wide screens are capped by the dialog's max width.
    expect(shouldStackDialogActions(['Cancel', 'Start now'], 320, theme)).toBe(true);
    expect(shouldStackDialogActions(['Cancel', 'Start now'], 1200, theme)).toBe(false);
    expect(shouldStackDialogActions(['Cancel', 'Confirm appointment'], 1200, theme)).toBe(true);
  });

  it('never stacks a single button', () => {
    expect(shouldStackDialogActions(['A very long single confirmation label'], 320, theme)).toBe(false);
  });
});

describe('ToastProvider', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('shows a toast, runs its action on tap and dismisses it', async () => {
    const onToastPress = jest.fn();
    await renderWithProviders(
      <ToastProvider>
        <ToastHarness onToastPress={onToastPress} />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('New offer received')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'New offer received. Tap to review' }));
    expect(onToastPress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('New offer received')).not.toBeOnTheScreen());
  });
});

describe('useErrorToast', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('shows the error title together with its explanation', async () => {
    await renderWithProviders(
      <ToastProvider>
        <ErrorToastHarness />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Fail' }));
    expect(screen.getByText(i18nText('errors:codes.OFFER_EXPIRED.title'))).toBeOnTheScreen();
    expect(screen.getByText(i18nText('errors:codes.OFFER_EXPIRED.description'))).toBeOnTheScreen();
  });

  it('can replace the heading but keeps the explanation', async () => {
    await renderWithProviders(
      <ToastProvider>
        <ErrorToastHarness title="Fix the highlighted fields" />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Fail' }));
    expect(screen.getByText('Fix the highlighted fields')).toBeOnTheScreen();
    expect(screen.getByText(i18nText('errors:codes.OFFER_EXPIRED.description'))).toBeOnTheScreen();
  });
});
