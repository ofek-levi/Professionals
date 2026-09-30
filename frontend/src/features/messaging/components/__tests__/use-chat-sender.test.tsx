/**
 * A failed send keeps the message with the reason: a lost connection can be retried, a closed chat
 * (409) cannot, so "retry" does nothing there and only "delete" remains.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import type { TransportRequest } from '@/services/api/transport';
import { MAIN_CUSTOMER_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';

import { failedMessagesStore } from '../failed-messages-store';
import { useChatSender } from '../use-chat-sender';

let env: TestEnvironment;
let conversationId: string;
/** What the next message sends answer; `null` = the test double. */
let answer: { status: number; data: unknown } | null = null;

beforeAll(async () => {
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport((request: TransportRequest) =>
    answer && request.method === 'POST' && request.path.endsWith('/messages') ? Promise.resolve({ ...answer, headers: {} }) : env.transport(request),
  );
  await sessionStore.signIn(env.signIn(MAIN_CUSTOMER_IDS.noa));
  const { items } = await env.as(MAIN_CUSTOMER_IDS.noa).conversations.getConversations();
  conversationId = items.find((item) => item.isOpen)!.id;
});

afterAll(async () => {
  await sessionStore.signOut();
  failedMessagesStore.clear();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useChatSender', () => {
  it('keeps why a message failed and never retries into a closed chat', async () => {
    const { result } = await renderHook(() => useChatSender(conversationId), { wrapper });

    answer = { status: 409, data: { code: 'CONFLICT', message: 'This conversation is closed' } };
    await act(async () => {
      result.current.send('Still coming?');
    });
    await waitFor(() => expect(result.current.failed).toHaveLength(1));
    const closed = result.current.failed[0]!;
    expect(closed).toMatchObject({ text: 'Still coming?', reason: 'closed' });

    answer = null;
    await act(async () => {
      result.current.retry(closed);
    });
    expect(result.current.failed).toEqual([closed]);

    answer = { status: 0, data: { code: 'NETWORK_ERROR', message: 'offline' } };
    await act(async () => {
      result.current.send('On my way');
    });
    await waitFor(() => expect(result.current.failed).toHaveLength(2));
    const offline = result.current.failed[1]!;
    expect(offline.reason).toBe('offline');

    answer = null;
    await act(async () => {
      result.current.retry(offline);
    });
    await waitFor(() => expect(result.current.failed).toEqual([closed]));

    await act(async () => {
      result.current.discard(closed);
    });
    expect(result.current.failed).toEqual([]);
  });
});
