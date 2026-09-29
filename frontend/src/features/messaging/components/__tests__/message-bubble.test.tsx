import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';
import type { Message } from '@/types/domain';

import type { ChatMessageRow } from '../chat-model';
import { MessageBubble } from '../message-bubble';

const createdAt = new Date(2026, 8, 27, 14, 5).toISOString();

function row(overrides: Partial<ChatMessageRow> = {}, messageOverrides: Partial<Message> = {}): ChatMessageRow {
  return {
    kind: 'message',
    key: 'm1',
    message: {
      id: 'm1',
      conversationId: 'cnv-1',
      senderId: 'me',
      text: 'See you at ten!',
      createdAt,
      readAt: null,
      clientMessageId: 'c1',
      ...messageOverrides,
    },
    mine: true,
    delivery: 'read',
    failed: null,
    groupedWithPrevious: false,
    groupedWithNext: false,
    ...overrides,
  };
}

describe('MessageBubble', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('announces own messages with time and read receipt', async () => {
    await renderWithProviders(<MessageBubble row={row()} counterpartName="Yael" onRetry={jest.fn()} onDiscard={jest.fn()} />);
    expect(screen.getByText('See you at ten!')).toBeOnTheScreen();
    expect(screen.getByText('14:05')).toBeOnTheScreen();
    expect(screen.getByLabelText('You, 14:05: See you at ten!. Read')).toBeOnTheScreen();
  });

  it('labels the counterpart’s messages with their name', async () => {
    await renderWithProviders(
      <MessageBubble row={row({ mine: false, delivery: null }, { senderId: 'them' })} counterpartName="Yael" onRetry={jest.fn()} onDiscard={jest.fn()} />,
    );
    expect(screen.getByLabelText('Yael, 14:05: See you at ten!')).toBeOnTheScreen();
  });

  it('retries a failed message on press and offers to delete it on long press', async () => {
    const failed = { clientMessageId: 'c1', text: 'See you at ten!', createdAt };
    const onRetry = jest.fn();
    const onDiscard = jest.fn();
    await renderWithProviders(
      <MessageBubble row={row({ delivery: 'failed', failed })} counterpartName="Yael" onRetry={onRetry} onDiscard={onDiscard} />,
    );
    expect(screen.getByText('Not sent · Tap to retry')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('chat-failed-c1'));
    expect(onRetry).toHaveBeenCalledWith(failed);
    await fireEvent(screen.getByTestId('chat-failed-c1'), 'longPress');
    expect(onDiscard).toHaveBeenCalledWith(failed);
  });
});
