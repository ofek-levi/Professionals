/**
 * In-memory store of chat messages whose send failed, per conversation. It lives outside React so
 * failed messages survive leaving and re-opening the chat during the session (the send mutation
 * removes their optimistic copy from the query cache on error).
 */
import { useSyncExternalStore } from 'react';

import type { FailedMessage } from './chat-model';

type Listener = () => void;

interface FailedMessagesStore {
  get: (conversationId: string) => readonly FailedMessage[];
  /** Adds (or replaces, by `clientMessageId`) a failed message. */
  add: (conversationId: string, message: FailedMessage) => void;
  remove: (conversationId: string, clientMessageId: string) => void;
  clear: () => void;
  subscribe: (listener: Listener) => () => void;
}

const EMPTY: readonly FailedMessage[] = [];

export function createFailedMessagesStore(): FailedMessagesStore {
  let state = new Map<string, readonly FailedMessage[]>();
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((listener) => listener());

  const set = (conversationId: string, messages: readonly FailedMessage[]) => {
    const next = new Map(state);
    if (messages.length > 0) next.set(conversationId, messages);
    else next.delete(conversationId);
    state = next;
    emit();
  };

  return {
    get: (conversationId) => state.get(conversationId) ?? EMPTY,
    add: (conversationId, message) => {
      const current = state.get(conversationId) ?? EMPTY;
      set(conversationId, [...current.filter((item) => item.clientMessageId !== message.clientMessageId), message]);
    },
    remove: (conversationId, clientMessageId) => {
      const current = state.get(conversationId) ?? EMPTY;
      if (!current.some((item) => item.clientMessageId === clientMessageId)) return;
      set(
        conversationId,
        current.filter((item) => item.clientMessageId !== clientMessageId),
      );
    },
    clear: () => {
      if (state.size === 0) return;
      state = new Map();
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** App-wide instance used by the chat screen. */
export const failedMessagesStore = createFailedMessagesStore();

export function useFailedMessages(conversationId: string, store: FailedMessagesStore = failedMessagesStore): readonly FailedMessage[] {
  return useSyncExternalStore(
    store.subscribe,
    () => store.get(conversationId),
    () => store.get(conversationId),
  );
}
