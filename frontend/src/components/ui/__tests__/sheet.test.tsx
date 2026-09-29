import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { DeviceEventEmitter, Platform, StyleSheet, View } from 'react-native';

import { initI18n } from '@/i18n';
import { spacing } from '@/theme';

import { renderWithProviders } from '../../__test-utils__/render';
import { AppText } from '../app-text';
import { Button } from '../button';
import { DialogProvider, useConfirm } from '../dialog-provider';
import { OverlayHostProvider } from '../overlay-host';
import { Sheet } from '../sheet';
import { ToastProvider, useToast } from '../toast-provider';

/** The app's overlay providers, as in `AppProviders`. */
function Overlays({ children }: { children: ReactNode }) {
  return (
    <OverlayHostProvider>
      <DialogProvider>
        <ToastProvider>{children}</ToastProvider>
      </DialogProvider>
    </OverlayHostProvider>
  );
}

function CancelSheet() {
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState('none');
  return (
    <>
      <Button label="Toast" onPress={() => toast.show({ title: 'Request cancelled' })} />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Cancel request" testID="sheet">
        <Button
          label="Submit"
          onPress={async () => setResult((await confirm({ title: 'Cancel this request?', confirmLabel: 'Yes, cancel' })) ? 'confirmed' : 'kept')}
        />
        <Button label="Toast from sheet" onPress={() => toast.show({ title: 'Could not cancel' })} />
        <Button label="Push banner" onPress={() => toast.show({ title: 'New offer', onPress: () => setResult('opened offer') })} />
        <Button label="Done" onPress={() => setOpen(false)} />
      </Sheet>
      <AppText>{`result:${result}`}</AppText>
    </>
  );
}

describe('Sheet', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a confirm dialog opened from the sheet inside the sheet (iOS presents it from there)', async () => {
    await renderWithProviders(
      <Overlays>
        <CancelSheet />
      </Overlays>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(within(screen.getByTestId('sheet')).getByText('Cancel this request?')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Yes, cancel' }));
    expect(await screen.findByText('result:confirmed')).toBeOnTheScreen();
  });

  it('shows toasts above the open sheet, and at the root once it is closed', async () => {
    await renderWithProviders(
      <Overlays>
        <CancelSheet />
      </Overlays>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Toast from sheet' }));
    expect(within(screen.getByTestId('sheet')).getByText('Could not cancel')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(screen.getByText('Could not cancel')).toBeOnTheScreen();
  });

  it('closes before a tapped toast opens another screen, so the screen is not hidden behind it', async () => {
    await renderWithProviders(
      <Overlays>
        <CancelSheet />
      </Overlays>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Push banner' }));
    await fireEvent.press(within(screen.getByTestId('sheet')).getByRole('button', { name: 'New offer' }));

    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(screen.getByText('result:opened offer')).toBeOnTheScreen();
    expect(screen.queryByText('New offer')).toBeNull();
  });

  it('reports that it has closed after its exit animation (Android, web)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const onClosed = jest.fn();
    const view = await renderWithProviders(<Sheet visible={false} onClose={jest.fn()} onClosed={onClosed} testID="sheet"><View /></Sheet>);
    await view.rerender(<Sheet visible onClose={jest.fn()} onClosed={onClosed} testID="sheet"><View /></Sheet>);
    // Neither mounting hidden nor opening counts as closing.
    expect(onClosed).not.toHaveBeenCalled();
    await view.rerender(<Sheet visible={false} onClose={jest.fn()} onClosed={onClosed} testID="sheet"><View /></Sheet>);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('reports that it has closed once iOS has dismissed its Modal', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const onClosed = jest.fn();
    const view = await renderWithProviders(<Sheet visible onClose={jest.fn()} onClosed={onClosed} testID="sheet"><View /></Sheet>);
    const modal = screen.getByTestId('sheet');
    await view.rerender(<Sheet visible={false} onClose={jest.fn()} onClosed={onClosed} testID="sheet"><View /></Sheet>);
    expect(onClosed).not.toHaveBeenCalled();
    await act(() => modal.props.onDismiss());
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('drops the bottom safe-area padding of its footer while the keyboard is up', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await renderWithProviders(
      <Sheet visible onClose={jest.fn()} footer={<View testID="footer-content" />}>
        <View />
      </Sheet>,
    );
    const footerPadding = () => StyleSheet.flatten(screen.getByTestId('footer-content').parent?.props.style).paddingBottom;
    expect(footerPadding()).toBe(34);
    await act(() => DeviceEventEmitter.emit('keyboardWillShow', { endCoordinates: { screenX: 0, screenY: 500, width: 390, height: 344 } }));
    expect(footerPadding()).toBe(spacing.lg);
    await act(() => DeviceEventEmitter.emit('keyboardWillHide', { endCoordinates: { screenX: 0, screenY: 844, width: 390, height: 0 } }));
    expect(footerPadding()).toBe(34);
  });
});
