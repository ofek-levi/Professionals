import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { initI18n } from '@/i18n';
import type { Message } from '@/types/domain';

import type { ChatMessageRow, FailedMessage } from '../chat-model';
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

  it('retries a message that failed offline, and deletes it with the visible button or a long press', async () => {
    const failed: FailedMessage = { clientMessageId: 'c1', text: 'See you at ten!', createdAt, reason: 'offline' };
    const onRetry = jest.fn();
    const onDiscard = jest.fn();
    await renderWithProviders(
      <MessageBubble row={row({ delivery: 'failed', failed })} counterpartName="Yael" onRetry={onRetry} onDiscard={onDiscard} />,
    );
    expect(screen.getByTestId('chat-failed-reason-c1')).toHaveTextContent('Not sent: no connection · Tap to retry');
    expect(screen.getByLabelText('You, 14:05: See you at ten!. Not sent: no connection')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('chat-failed-c1'));
    expect(onRetry).toHaveBeenCalledWith(failed);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete the unsent message' }));
    expect(onDiscard).toHaveBeenCalledWith(failed);
    await fireEvent(screen.getByTestId('chat-failed-c1'), 'longPress');
    expect(onDiscard).toHaveBeenCalledTimes(2);
  });

  it('says why a message in a closed chat failed and offers no retry', async () => {
    const failed: FailedMessage = { clientMessageId: 'c2', text: 'Still coming?', createdAt, reason: 'closed' };
    const onRetry = jest.fn();
    const onDiscard = jest.fn();
    await renderWithProviders(
      <MessageBubble row={row({ delivery: 'failed', failed })} counterpartName="Yael" onRetry={onRetry} onDiscard={onDiscard} />,
    );
    expect(screen.getByTestId('chat-failed-reason-c2')).toHaveTextContent('Not sent: this chat is closed');
    await fireEvent.press(screen.getByTestId('chat-failed-c2'));
    expect(onRetry).not.toHaveBeenCalled();
    // Screen readers get "Delete" as an action of the message.
    await fireEvent(screen.getByTestId('chat-failed-c2'), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(onDiscard).toHaveBeenCalledWith(failed);
  });
});
