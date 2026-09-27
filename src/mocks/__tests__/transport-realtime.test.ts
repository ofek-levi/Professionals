import type { RealtimeEvent } from '@/services/realtime/types';

import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createMockRealtimeClient } from '../realtime';
import { createAccessToken } from '../server/auth';
import { createMockTransport } from '../transport';
import { createTestEnvironment, minutesFromNow } from '../testing/test-server';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mock transport', () => {
  it('forwards requests to the server without latency', async () => {
    const env = await createTestEnvironment();
    const { transport } = createMockTransport(env.server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 0 });
    const response = await transport({ method: 'GET', path: '/catalog/categories', headers: {} });
    expect(response.status).toBe(200);
    const notFound = await transport({ method: 'GET', path: '/nope', headers: {} });
    expect(notFound).toMatchObject({ status: 404, data: { code: 'NOT_FOUND' } });
    const withQuery = await transport({
      method: 'GET',
      path: '/professional/requests/nearby',
      query: { categoryIds: ['plumbing'], sort: 'nearest', excludeWithMyOffer: true },
      headers: { Authorization: `Bearer ${createAccessToken(PRO_IDS.avi)}` },
    });
    expect(withQuery.status).toBe(200);
    const invalidQuery = await transport({
      method: 'GET',
      path: '/professional/requests/nearby?sort=random',
      headers: { authorization: `Bearer ${createAccessToken(PRO_IDS.avi)}` },
    });
    expect(invalidQuery).toMatchObject({ status: 422, data: { code: 'VALIDATION_ERROR', fieldErrors: { sort: ['validation:invalid'] } } });
  });

  it('simulates network failures and exposes controls', async () => {
    const env = await createTestEnvironment();
    const { transport, controls } = createMockTransport(env.server, { minLatencyMs: 0, maxLatencyMs: 0, failureRate: 1 });
    expect(await transport({ method: 'GET', path: '/catalog/categories', headers: {} })).toEqual({
      status: 0,
      data: { code: 'NETWORK_ERROR', message: expect.any(String) },
    });
    controls.setFailureRate(0);
    expect(controls.getFailureRate()).toBe(0);
    expect((await transport({ method: 'GET', path: '/catalog/categories', headers: {} })).status).toBe(200);
    controls.setFailureRate(7);
    expect(controls.getFailureRate()).toBe(1);
  });

  it('never mutates the caller’s body and supports cancellation', async () => {
    const env = await createTestEnvironment();
    const { transport } = createMockTransport(env.server, { minLatencyMs: 20, maxLatencyMs: 40, failureRate: 0 });
    const body = { userId: DEMO_CUSTOMER_IDS.noa };
    const session = await transport({ method: 'POST', path: '/auth/demo-login', body, headers: {} });
    expect(session.status).toBe(200);
    expect(body).toEqual({ userId: DEMO_CUSTOMER_IDS.noa });

    const aborted = new AbortController();
    aborted.abort();
    await expect(transport({ method: 'GET', path: '/catalog/categories', headers: {}, signal: aborted.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    const midway = new AbortController();
    const pending = transport({ method: 'GET', path: '/catalog/categories', headers: {}, signal: midway.signal });
    midway.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('mock realtime client', () => {
  it('delivers events for the connected user asynchronously', async () => {
    const env = await createTestEnvironment();
    const client = createMockRealtimeClient(env.server, { deliveryDelayMs: 0 });
    const received: RealtimeEvent[] = [];
    const unsubscribe = client.subscribe((event) => received.push(event));
    client.connect(createAccessToken(DEMO_CUSTOMER_IDS.noa));
    client.connect(createAccessToken(DEMO_CUSTOMER_IDS.noa)); // idempotent

    await env.as(PRO_IDS.avi).offers.updateOffer(SEED_IDS.offers.leakAvi, { price: 610 });
    expect(received).toHaveLength(0); // asynchronous delivery
    await flush();
    const types = received.map((event) => event.type).sort();
    expect(types).toEqual(['notification.created', 'offer.updated', 'request.updated']);
    const notification = received.find((event) => event.type === 'notification.created');
    expect(notification?.type === 'notification.created' && notification.notification.type).toBe('offer_updated');

    // Events for other users are not delivered.
    received.length = 0;
    await env.as(PRO_IDS.lior).conversations.sendMessage(SEED_IDS.conversations.danielWifi, { text: 'Done!', clientMessageId: 'x' });
    await flush();
    expect(received).toHaveLength(0);

    // Switching accounts re-subscribes; disconnecting stops delivery.
    client.connect(createAccessToken(DEMO_CUSTOMER_IDS.daniel));
    await env.as(PRO_IDS.lior).conversations.sendMessage(SEED_IDS.conversations.danielWifi, { text: 'All set.', clientMessageId: 'y' });
    await flush();
    expect(received.some((event) => event.type === 'message.created')).toBe(true);
    client.disconnect();
    received.length = 0;
    await env.as(PRO_IDS.lior).conversations.sendMessage(SEED_IDS.conversations.danielWifi, { text: 'Bye', clientMessageId: 'z' });
    await flush();
    expect(received).toHaveLength(0);
    unsubscribe();
  });

  it('does not emit events for failed (rolled back) operations', async () => {
    const env = await createTestEnvironment();
    const events: RealtimeEvent[] = [];
    env.server.events.subscribe('user_tamar_shalev', (event) => events.push(event));
    const failed = env.as(PRO_IDS.avi).offers.createOffer('req_tamar_sink', {
      price: 400,
      currency: 'ILS',
      proposedStartAt: minutesFromNow(env, 5),
      estimatedDurationMinutes: null,
      message: null,
    });
    await expect(failed).rejects.toMatchObject({ status: 422 });
    expect(events).toHaveLength(0);
  });
});
