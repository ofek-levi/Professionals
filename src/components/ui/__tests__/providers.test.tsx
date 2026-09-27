/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import { initI18n } from '@/i18n';

import { renderWithProviders } from '../../__test-utils__/render';
import { AppText } from '../app-text';
import { Button } from '../button';
import { DialogProvider, useConfirm } from '../dialog-provider';
import { ToastProvider, useToast } from '../toast-provider';

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
