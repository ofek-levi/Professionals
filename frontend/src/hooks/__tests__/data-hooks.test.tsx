/**
 * Data hooks against the real endpoint modules and the in-app mock backend (zero latency):
 * user scoping, role gating, seeding + invalidation after accepting an offer and the optimistic
 * flows (chat messages, notifications).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { isPendingMessage } from '@/hooks/mutations/cache-updates';
import { useMarkNotificationAsRead } from '@/hooks/mutations/use-notification-mutations';
import { useUpdateCustomerProfile } from '@/hooks/mutations/use-profile-mutations';
import { useMarkConversationAsRead, useSendMessage } from '@/hooks/mutations/use-message-mutations';
import { useAcceptOffer } from '@/hooks/mutations/use-offer-mutations';
import { useCurrentUser } from '@/hooks/queries/use-auth-queries';
import { useConversationMessages, useConversations } from '@/hooks/queries/use-conversation-queries';
import { useCustomerProfile } from '@/hooks/queries/use-customer-queries';
import { useCustomerDashboard, useProfessionalDashboard } from '@/hooks/queries/use-dashboard-queries';
import { queryKeys } from '@/hooks/queries/query-keys';
import { useUnreadNotificationsCount, useUpdateNotifications } from '@/hooks/queries/use-notification-queries';
import { useRequestOffers } from '@/hooks/queries/use-offer-queries';
import { NEARBY_MAP_LIMIT, useNearbyRequestsForMap, useRequest } from '@/hooks/queries/use-request-queries';
import { APP_CONFIG } from '@/constants/app-config';
import { MAIN_CUSTOMER_IDS, PRO_IDS } from '@/test-utils/mock-backend/data/seed';
import { createTestEnvironment, type TestEnvironment } from '@/test-utils/mock-backend/testing/test-server';
import { apiClient } from '@/services/api';
import { sessionStore } from '@/services/auth/session-store';

interface Account {
  userId: string;
}

let env: TestEnvironment;
const customer: Account = { userId: MAIN_CUSTOMER_IDS.noa };
const professional: Account = { userId: PRO_IDS.avi };

beforeAll(() => {
  // The app's token manager reads the device clock: the server clock starts there too.
  env = createTestEnvironment({ now: new Date() });
  apiClient.setTransport(env.transport);
});

afterEach(async () => {
  await sessionStore.signOut();
});

async function signInAs(account: Account) {
  await sessionStore.signIn(env.signIn(account.userId));
}

function createWrapper() {
  const client = new QueryClient({
    // Infinite gcTime: no garbage-collection timers keep Jest alive after the tests.
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, wrapper: Wrapper };
}

describe('query scoping', () => {
  it('stays idle while signed out', async () => {
    await sessionStore.signOut();
    const { wrapper } = createWrapper();
    const { result } = await renderHook(() => useCurrentUser(), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('only runs role-specific queries for that role', async () => {
    await signInAs(professional);
    const { wrapper } = createWrapper();
    const { result } = await renderHook(
      () => ({ customerDashboard: useCustomerDashboard(), professionalDashboard: useProfessionalDashboard() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.professionalDashboard.isSuccess).toBe(true));
    expect(result.current.customerDashboard.fetchStatus).toBe('idle');
  });

  it('keys every query by the signed-in user', async () => {
    await signInAs(customer);
    const { wrapper, client } = createWrapper();
    const { result } = await renderHook(() => useCurrentUser(), { wrapper });
    await waitFor(() => expect(result.current.data?.user.id).toBe(customer.userId));
    expect(client.getQueryCache().getAll().map((query) => query.queryKey[1])).toEqual([customer.userId]);
  });
});

describe('useNearbyRequestsForMap', () => {
  it('asks for the largest page the API accepts and gets the markers', async () => {
    expect(NEARBY_MAP_LIMIT).toBe(APP_CONFIG.maxPageSize);
    await signInAs(professional);
    const { wrapper } = createWrapper();
    const { result } = await renderHook(() => useNearbyRequestsForMap(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
    expect(result.current.data?.items.length).toBeLessThanOrEqual(NEARBY_MAP_LIMIT);
  });
});

describe('useAcceptOffer', () => {
  it('seeds the request detail and refreshes offers and dashboards', async () => {
    await signInAs(customer);
    const customerApi = env.as(customer.userId);
    const { items } = await customerApi.requests.getCustomerRequests({ section: 'has_offers' });
    const request = items.find((item) => item.pendingOfferCount > 0)!;
    const { items: offers } = await customerApi.offers.getOffersForRequest(request.id);
    const offer = offers.find((item) => item.status === 'pending')!;
    const { wrapper } = createWrapper();
    const { result } = await renderHook(
      () => ({
        request: useRequest(request.id),
        offers: useRequestOffers(request.id),
        dashboard: useCustomerDashboard(),
        accept: useAcceptOffer(),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.request.isSuccess).toBe(true);
      expect(result.current.offers.isSuccess).toBe(true);
      expect(result.current.dashboard.isSuccess).toBe(true);
    });
    const activeJobsBefore = result.current.dashboard.data!.activeJobsCount;

    await act(async () => {
      await result.current.accept.mutateAsync(offer.id);
    });

    // Seeded synchronously from the mutation response…
    expect(result.current.request.data?.request.status).toBe('professional_selected');
    expect(result.current.request.data?.request.acceptedOfferId).toBe(offer.id);
    // …and refetched together with the offers and the dashboard.
    await waitFor(() => {
      expect(result.current.offers.data?.find((item) => item.id === offer.id)?.status).toBe('accepted');
      expect(result.current.dashboard.data?.activeJobsCount).toBe(activeJobsBefore + 1);
    });
    expect(result.current.offers.data?.filter((item) => item.status === 'pending')).toEqual([]);
  });
});

describe('useSendMessage', () => {
  it('shows the message optimistically and reconciles it with the server copy', async () => {
    await signInAs(customer);
    const { items: conversations } = await env.as(customer.userId).conversations.getConversations();
    const conversation = conversations.find((item) => item.isOpen)!;

    const { wrapper } = createWrapper();
    const { result } = await renderHook(
      () => ({ messages: useConversationMessages(conversation.id), sender: useSendMessage(conversation.id) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.messages.isSuccess).toBe(true));

    await act(async () => {
      result.current.sender.send('Is Thursday morning OK?');
    });
    await waitFor(() => expect(result.current.sender.isSuccess).toBe(true));

    const sent = result.current.messages.data!.items.filter((item) => item.text === 'Is Thursday morning OK?');
    expect(sent).toHaveLength(1);
    expect(isPendingMessage(sent[0])).toBe(false);
    expect(result.current.messages.data!.items[0].id).toBe(sent[0].id);
  });

  it('rolls the optimistic message back when sending fails', async () => {
    await signInAs(customer);
    const { items: conversations } = await env.as(customer.userId).conversations.getConversations();
    const conversation = conversations.find((item) => item.isOpen)!;
    const { wrapper } = createWrapper();
    const { result } = await renderHook(
      () => ({ messages: useConversationMessages(conversation.id), sender: useSendMessage(conversation.id) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.messages.isSuccess).toBe(true));
    const countBefore = result.current.messages.data!.items.length;

    await act(async () => {
      // Over the length limit → rejected by the server's validation.
      result.current.sender.send('x'.repeat(5000));
    });
    await waitFor(() => expect(result.current.sender.isError).toBe(true));
    expect(result.current.messages.data!.items).toHaveLength(countBefore);
    expect(result.current.messages.data!.items.some(isPendingMessage)).toBe(false);
  });
});

describe('useMarkConversationAsRead', () => {
  it('clears the unread counter optimistically and restores it when the request fails', async () => {
    await signInAs(customer);
    const [conversation] = (await env.as(customer.userId).conversations.getConversations()).items.filter((item) => item.isOpen);
    const counterpart = conversation.participants.find((participant) => participant.userId !== customer.userId)!;
    await env.as(counterpart.userId).conversations.sendMessage(conversation.id, { text: 'Are you home?', clientMessageId: 'unread-1' });

    const { wrapper } = createWrapper();
    const { result } = await renderHook(() => ({ list: useConversations(), markRead: useMarkConversationAsRead() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const unreadOf = () => result.current.list.data!.items.find((item) => item.id === conversation.id)?.unreadCount;
    const before = unreadOf();
    expect(before).toBeGreaterThan(0);

    // Offline: every request fails with a network error → the optimistic update is rolled back.
    apiClient.setTransport(async () => ({ status: 0, data: { code: 'NETWORK_ERROR', message: 'offline' } }));
    try {
      await act(async () => {
        await result.current.markRead.mutateAsync(conversation.id).catch(() => undefined);
      });
      expect(result.current.markRead.isError).toBe(true);
      expect(unreadOf()).toBe(before);
    } finally {
      apiClient.setTransport(env.transport);
    }
  });
});

describe('useUpdateCustomerProfile', () => {
  it('never flips a quickly toggled preference back while an earlier update settles', async () => {
    await signInAs(customer);
    const { client, wrapper } = createWrapper();
    const { result } = await renderHook(() => ({ profile: useCustomerProfile(), update: useUpdateCustomerProfile() }), { wrapper });
    await waitFor(() => expect(result.current.profile.isSuccess).toBe(true));
    const initial = result.current.profile.data!.profile.notificationPreferences;
    const key = queryKeys.customer.profile(customer.userId);
    const remindersSeen: boolean[] = [];
    const unsubscribe = client.getQueryCache().subscribe(() => {
      const data = client.getQueryData<{ profile: { notificationPreferences: typeof initial } }>(key);
      if (data) remindersSeen.push(data.profile.notificationPreferences.reminders);
    });

    const first = { ...initial, messages: !initial.messages };
    const second = { ...first, reminders: !initial.reminders };
    await act(async () => {
      await Promise.all([
        result.current.update.mutateAsync({ notificationPreferences: first }),
        result.current.update.mutateAsync({ notificationPreferences: second }),
      ]);
    });
    await waitFor(() => expect(client.isFetching()).toBe(0));
    unsubscribe();

    const toggledAt = remindersSeen.indexOf(!initial.reminders);
    expect(toggledAt).toBeGreaterThanOrEqual(0);
    expect(remindersSeen.slice(toggledAt).every((value) => value === !initial.reminders)).toBe(true);
    expect(result.current.profile.data!.profile.notificationPreferences).toMatchObject({
      messages: !initial.messages,
      reminders: !initial.reminders,
    });
  });
});

describe('useMarkNotificationAsRead', () => {
  it('marks the notification read and decrements the unread badge', async () => {
    await signInAs(customer);
    const { wrapper } = createWrapper();
    const { result } = await renderHook(
      () => ({ list: useUpdateNotifications(), unread: useUnreadNotificationsCount(), markRead: useMarkNotificationAsRead() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.unread.isSuccess).toBe(true);
    });
    const unread = result.current.list.data!.items.find((item) => item.readAt === null);
    expect(unread).toBeDefined();
    const before = result.current.unread.data!;

    await act(async () => {
      await result.current.markRead.mutateAsync(unread!.id);
    });

    await waitFor(() => expect(result.current.unread.data).toBe(before - 1));
    expect(result.current.list.data!.items.find((item) => item.id === unread!.id)?.readAt).not.toBeNull();
  });
});
