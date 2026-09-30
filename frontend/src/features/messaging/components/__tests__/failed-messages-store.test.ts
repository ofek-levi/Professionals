import type { FailedMessage } from '../chat-model';
import { createFailedMessagesStore } from '../failed-messages-store';

const failed = (clientMessageId: string, text = 'hello'): FailedMessage => ({
  clientMessageId,
  text,
  createdAt: '2026-09-27T10:00:00.000Z',
  reason: 'offline',
});

describe('failed messages store', () => {
  it('adds, replaces and removes messages per conversation and notifies subscribers', () => {
    const store = createFailedMessagesStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.add('a', failed('1'));
    store.add('a', failed('2'));
    store.add('b', failed('3'));
    expect(store.get('a').map((item) => item.clientMessageId)).toEqual(['1', '2']);
    expect(store.get('b')).toHaveLength(1);

    store.add('a', failed('1', 'edited'));
    expect(store.get('a').map((item) => item.text)).toEqual(['hello', 'edited']);

    store.remove('a', '2');
    store.remove('a', 'missing');
    expect(store.get('a').map((item) => item.clientMessageId)).toEqual(['1']);
    expect(listener).toHaveBeenCalledTimes(5);

    unsubscribe();
    store.clear();
    expect(store.get('a')).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(5);
  });

  it('returns a stable empty list for unknown conversations', () => {
    const store = createFailedMessagesStore();
    expect(store.get('x')).toBe(store.get('y'));
  });
});
