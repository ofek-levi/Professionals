import { validateOfferAgainstRequest } from '@/features/offers/offer-rules';

import { CATEGORY_PRICE_RANGES } from '../data/price-ranges';
import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { AUTO_REPLY_DELAY_MS } from '../server/services/simulator';
import { createTestEnvironment, type TestEnvironment } from '../testing/test-server';

const NOA = DEMO_CUSTOMER_IDS.noa;

const publishPlumbingRequest = (env: TestEnvironment, description = 'The kitchen faucet is leaking at the base.') =>
  env.as(NOA).requests.createRequest({
    categoryId: 'plumbing',
    description,
    location: {
      coordinates: { latitude: 32.0565, longitude: 34.7702 },
      addressLine: 'Vital St 5',
      city: 'Tel Aviv-Yafo',
      neighborhood: 'Florentin',
      details: null,
    },
    urgency: 'urgent',
    preferredSchedule: null,
    photoIds: [],
    notes: null,
    publish: true,
  });

describe('demo simulator', () => {
  it('sends 2–3 realistic offers from non-demo professionals after publishing', async () => {
    const env = await createTestEnvironment({ simulation: true });
    const request = await publishPlumbingRequest(env);
    const delays = env.scheduled.map((task) => task.delayMs);
    expect(delays.length).toBeGreaterThanOrEqual(2);
    expect(delays.length).toBeLessThanOrEqual(3);
    expect(delays[0]).toBeGreaterThan(5000);
    expect(delays[0]).toBeLessThan(7000);
    expect(delays[1]).toBeGreaterThan(14000);

    env.clock.advanceMinutes(1);
    env.runScheduled();
    const offers = env.server.internals.db.offers.filter((offer) => offer.requestId === request.id);
    expect(offers).toHaveLength(delays.length);
    const range = CATEGORY_PRICE_RANGES.plumbing;
    for (const offer of offers) {
      expect([PRO_IDS.yossi, PRO_IDS.eli]).toContain(offer.professionalId); // matching, non-demo plumbers
      expect(offer.status).toBe('pending');
      expect(offer.price).toBeGreaterThanOrEqual(range.min);
      expect(offer.price).toBeLessThanOrEqual(range.max);
      expect(new Date(offer.proposedStartAt).getMinutes() % 15).toBe(0);
      expect(offer.message).toBeTruthy();
      const stored = env.server.internals.db.requests.require(request.id, 'Request');
      expect(validateOfferAgainstRequest({ proposedStartAt: offer.proposedStartAt, request: stored, now: offer.createdAt }).isValid).toBe(true);
    }
    expect(env.server.internals.db.requests.require(request.id, 'Request').status).toBe('offers_received');
    expect(env.server.internals.db.notifications.filter((n) => n.userId === NOA && n.type === 'offer_received' && n.target.kind === 'offer' && n.target.requestId === request.id)).toHaveLength(offers.length);
  });

  it('skips simulated offers when the request was cancelled meanwhile', async () => {
    const env = await createTestEnvironment({ simulation: true });
    const request = await publishPlumbingRequest(env);
    await env.as(NOA).requests.cancelRequest(request.id, { reason: 'no_longer_needed' });
    env.runScheduled();
    expect(env.server.internals.db.offers.filter((offer) => offer.requestId === request.id)).toHaveLength(0);
  });

  it('auto-replies once to chat messages, in the language of the message', async () => {
    const env = await createTestEnvironment({ simulation: true });
    const conversationId = SEED_IDS.conversations.noaLighting;
    await env.as(NOA).conversations.sendMessage(conversationId, { text: 'מתי את מגיעה מחר?', clientMessageId: 'he-1' });
    await env.as(NOA).conversations.sendMessage(conversationId, { text: 'ועוד שאלה', clientMessageId: 'he-2' });
    expect(env.scheduled.map((task) => task.delayMs)).toEqual([AUTO_REPLY_DELAY_MS]);
    env.runScheduled();
    const [reply] = (await env.as(NOA).conversations.getConversationMessages(conversationId, { limit: 1 })).items;
    expect(reply.senderId).toBe(PRO_IDS.yael);
    expect(reply.text).toMatch(/[א-ת]/);
    // The auto reply itself never triggers another reply.
    expect(env.scheduled).toHaveLength(0);

    await env.as(PRO_IDS.yael).conversations.sendMessage(conversationId, { text: 'What is the parking situation?', clientMessageId: 'en-1' });
    env.runScheduled();
    const [customerReply] = (await env.as(NOA).conversations.getConversationMessages(conversationId, { limit: 1 })).items;
    expect(customerReply.senderId).toBe(NOA);
    expect(customerReply.text).toMatch(/[a-z]/i);
  });

  it('does nothing when disabled', async () => {
    const env = await createTestEnvironment({ simulation: true });
    env.server.setSimulationEnabled(false);
    expect(env.server.isSimulationEnabled()).toBe(false);
    await publishPlumbingRequest(env);
    await env.as(NOA).conversations.sendMessage(SEED_IDS.conversations.noaLighting, { text: 'Hi', clientMessageId: 'x' });
    expect(env.scheduled).toHaveLength(0);
  });
});
