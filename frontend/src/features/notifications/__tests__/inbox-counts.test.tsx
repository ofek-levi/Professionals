/**
 * Inbox counts (Updates / Messages segments and the tab badge) against the backend test double:
 * chat notifications are left out by the server, so the counts stay right however many unread
 * updates come before them, and the Updates list keeps paging past runs of chat notifications.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useUpdateNotifications } from '@/hooks/queries/use-notification-queries';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';
import { PRO_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';
import type { AppNotification } from '@/types/domain';

import { countInboxUnread, isUpdateNotification, useInboxCounts } from '../inbox-counts';

const PRO = PRO_IDS.avi;
let env: TestEnvironment;

beforeAll(() => {
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
});

afterEach(async () => {
  await sessionStore.signOut();
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Replaces the pro's inbox with `items` (newest last), `minutes` apart. */
function seedInbox(items: { type: AppNotification['type']; read?: boolean }[]) {
  const { db } = env.server.internals;
  for (const existing of db.notifications.filter((notification) => notification.userId === PRO)) db.notifications.delete(existing.id);
  const start = Date.now() - items.length * 60_000;
  items.forEach((item, index) => {
    db.notifications.insert({
      id: `ntf_seed_${index}`,
      userId: PRO,
      type: item.type,
      params: {},
      target: { kind: 'none' },
      readAt: item.read ? new Date(start).toISOString() : null,
      createdAt: new Date(start + index * 60_000).toISOString(),
    });
  });
}

describe('countInboxUnread', () => {
  it('adds unread chat messages to the unread updates, never below zero', () => {
    expect(countInboxUnread({ unreadUpdates: 2, unreadMessages: 3 })).toEqual({ updates: 2, messages: 3, total: 5 });
    expect(countInboxUnread({ unreadUpdates: -1, unreadMessages: 0 })).toEqual({ updates: 0, messages: 0, total: 0 });
  });

  it('keeps chat notifications out of Updates', () => {
    expect(isUpdateNotification({ type: 'new_message' })).toBe(false);
    expect(isUpdateNotification({ type: 'offer_received' })).toBe(true);
  });
});

describe('useInboxCounts', () => {
  it('counts 25 newer unread updates and an older chat notification right (not 26 updates)', async () => {
    seedInbox([{ type: 'new_message' }, ...Array.from({ length: 25 }, () => ({ type: 'new_matching_request' as const }))]);
    await sessionStore.signIn(env.signIn(PRO));
    const unreadMessages = (await env.as(PRO).conversations.getUnreadMessagesCount()).count;

    const { result } = await renderHook(() => useInboxCounts(), { wrapper });
    await waitFor(() => expect(result.current.updates).toBe(25));
    expect(result.current).toEqual({ updates: 25, messages: unreadMessages, total: 25 + unreadMessages });
  });
});

describe('useUpdateNotifications', () => {
  it('pages past runs of chat notifications to the older updates', async () => {
    // Oldest first: 1 update, then 45 (read) chat notifications, then 1 update.
    seedInbox([{ type: 'job_completed' }, ...Array.from({ length: 45 }, () => ({ type: 'new_message' as const, read: true })), { type: 'offer_accepted' }]);
    await sessionStore.signIn(env.signIn(PRO));

    const { result } = await renderHook(() => useUpdateNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.map((item) => item.type)).toEqual(['offer_accepted', 'job_completed']);
    expect(result.current.hasNextPage).toBe(false);
    await act(async () => undefined);
  });
});
