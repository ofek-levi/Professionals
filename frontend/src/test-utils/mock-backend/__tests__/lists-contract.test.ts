/**
 * List contract of the double (backend/docs/API.md → Pagination, Contract changes): conversations,
 * a request's offers and jobs are `Paginated<…>`, the inbox badge has its own count, cursors and
 * limits are validated with 400, and the explorer takes only the distance presets.
 */
import { DISTANCE_FILTERS_KM } from '@/types/api';

import { MAIN_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;

describe('paginated lists', () => {
  it('pages conversations with a stable totalCount and validates cursor and limit', async () => {
    const env = createTestEnvironment();
    const api = env.as(NOA).conversations;
    const all = await api.getConversations({ limit: 100 });
    expect(all.totalCount).toBe(all.items.length);
    expect(all.nextCursor).toBeNull();
    expect(all.items.length).toBeGreaterThan(1);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await api.getConversations({ limit: 1, cursor });
      expect(page.items).toHaveLength(1);
      expect(page.totalCount).toBe(all.totalCount);
      seen.push(page.items[0].id);
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.items.map((item) => item.id));

    expect(await expectApiError(api.getConversations({ cursor: 'tampered' }))).toMatchObject({ status: 400, fieldErrors: { cursor: ['validation:invalid'] } });
    expect(await expectApiError(api.getConversations({ limit: 101 }))).toMatchObject({ status: 400, fieldErrors: { limit: ['validation:invalid'] } });
  });

  it('pages a request’s offers and the jobs of each scope', async () => {
    const env = createTestEnvironment();
    const offers = await env.as(NOA).offers.getOffersForRequest(SEED_IDS.requests.noaLeak, { limit: 100 });
    expect(offers).toEqual({ items: expect.any(Array), nextCursor: null, totalCount: 3 });
    const firstTwo = await env.as(NOA).offers.getOffersForRequest(SEED_IDS.requests.noaLeak, { limit: 2 });
    expect(firstTwo.items).toHaveLength(2);
    expect(firstTwo.nextCursor).not.toBeNull();

    for (const userId of [NOA, PRO_IDS.lior]) {
      for (const scope of ['active', 'completed'] as const) {
        const jobs = await env.as(userId).jobs.getJobs({ scope, limit: 100 });
        expect(jobs).toMatchObject({ items: expect.any(Array), nextCursor: null });
        expect(jobs.totalCount).toBe(jobs.items.length);
      }
    }
  });
});

describe('GET /conversations/unread-count', () => {
  it('counts unread messages over all conversations, follows new messages and reads', async () => {
    const env = createTestEnvironment();
    const noa = env.as(NOA).conversations;
    const { items } = await noa.getConversations({ limit: 100 });
    const sum = items.reduce((total, item) => total + item.unreadCount, 0);
    await expect(noa.getUnreadMessagesCount()).resolves.toEqual({ count: sum });

    const conversation = items.find((item) => item.isOpen)!;
    const counterpart = conversation.participants.find((participant) => participant.userId !== NOA)!;
    await env.as(counterpart.userId).conversations.sendMessage(conversation.id, { text: 'Are you home?', clientMessageId: 'u-1' });
    await expect(noa.getUnreadMessagesCount()).resolves.toEqual({ count: sum + 1 });

    await noa.markConversationAsRead(conversation.id);
    await expect(noa.getUnreadMessagesCount()).resolves.toEqual({ count: sum - conversation.unreadCount });
  });
});

describe('explorer distance', () => {
  it('accepts only the app’s presets for maxDistanceKm', async () => {
    const env = createTestEnvironment();
    const avi = env.as(PRO_IDS.avi).requests;
    expect([...DISTANCE_FILTERS_KM]).toEqual([5, 10, 20, 40]);
    for (const maxDistanceKm of DISTANCE_FILTERS_KM) {
      await expect(avi.getNearbyOpenRequests({ maxDistanceKm })).resolves.toMatchObject({ items: expect.any(Array) });
    }
    expect(await expectApiError(avi.getNearbyOpenRequests({ maxDistanceKm: 15 as 5 }))).toMatchObject({
      status: 400,
      fieldErrors: { maxDistanceKm: ['validation:invalid'] },
    });
  });
});
