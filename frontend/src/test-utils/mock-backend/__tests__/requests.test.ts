import type { CreateServiceRequestPayload } from '@/types/api';

import { MAIN_CUSTOMER_IDS, MAIN_PRO_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, minutesFromNow, type TestEnvironment } from '../testing/test-server';

const NOA = MAIN_CUSTOMER_IDS.noa;
const DANIEL = MAIN_CUSTOMER_IDS.daniel;

/** Florentin, Tel Aviv – inside the areas of Avi, Yossi and Eli (plumbing). */
const florentin: CreateServiceRequestPayload['location'] = {
  coordinates: { latitude: 32.0565, longitude: 34.7702 },
  addressLine: 'Vital St 5',
  city: 'Tel Aviv-Yafo',
  neighborhood: 'Florentin',
  details: 'Floor 2',
};

const payload = (overrides: Partial<CreateServiceRequestPayload> = {}): CreateServiceRequestPayload => ({
  categoryId: 'plumbing',
  description: 'The bathroom faucet drips constantly and the handle is loose.',
  location: florentin,
  urgency: 'normal',
  preferredSchedule: null,
  photoIds: [],
  notes: null,
  publish: true,
  ...overrides,
});

const notificationsOf = (env: TestEnvironment, userId: string, type: string, requestId?: string) =>
  env.server.internals.db.notifications.filter(
    (notification) =>
      notification.userId === userId &&
      notification.type === type &&
      (!requestId || (notification.target.kind === 'request' && notification.target.requestId === requestId)),
  );

describe('service requests', () => {
  let env: TestEnvironment;
  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('publishes a request and notifies only matching professionals', async () => {
    const created = await env.as(NOA).requests.createRequest(payload());
    expect(created).toMatchObject({ status: 'open', offerCount: 0, latestOfferAt: null, lowestOfferPrice: null });
    expect(created.publishedAt).not.toBeNull();

    const notified = env.server.internals.db.notifications
      .filter((n) => n.type === 'new_matching_request' && n.target.kind === 'request' && n.target.requestId === created.id)
      .map((n) => n.userId)
      .sort();
    // Plumbers covering Florentin: Avi (main), Yossi and Eli – never electricians or movers.
    expect(notified).toEqual([PRO_IDS.avi, PRO_IDS.eli, PRO_IDS.yossi].sort());
    const [avisNotification] = notificationsOf(env, PRO_IDS.avi, 'new_matching_request', created.id);
    expect(avisNotification.params).toMatchObject({ categoryId: 'plumbing', customerName: 'Noa L.' });
    expect(avisNotification.params.distanceKm).toBeGreaterThan(0);

    const nearby = await env.as(MAIN_PRO_IDS.avi).requests.getNearbyOpenRequests({ sort: 'newest' });
    expect(nearby.items[0].id).toBe(created.id);
    const yael = await env.as(MAIN_PRO_IDS.yael).requests.getNearbyOpenRequests();
    expect(yael.items.map((request) => request.id)).not.toContain(created.id);
  });

  it('does not deliver requests outside a professional’s service area', async () => {
    // South Rehovot is ~22 km from Avi's base (radius 20 km) but inside Yossi's 35 km.
    const rehovot = await env.as(DANIEL).requests.createRequest(
      payload({
        location: { ...florentin, coordinates: { latitude: 31.87, longitude: 34.815 }, city: 'Rehovot', neighborhood: null },
      }),
    );
    expect(notificationsOf(env, PRO_IDS.avi, 'new_matching_request', rehovot.id)).toHaveLength(0);
    expect(notificationsOf(env, PRO_IDS.yossi, 'new_matching_request', rehovot.id)).toHaveLength(1);
  });

  it('saves, edits, publishes and deletes drafts', async () => {
    const api = env.as(NOA).requests;
    const draft = await api.createRequest(payload({ publish: false, categoryId: 'electrical' }));
    expect(draft).toMatchObject({ status: 'draft', publishedAt: null });
    expect(env.server.internals.db.notifications.filter((n) => n.target.kind === 'request' && n.target.requestId === draft.id)).toHaveLength(0);

    const edited = await api.updateDraftRequest(draft.id, { categoryId: 'plumbing', urgency: 'urgent' });
    expect(edited).toMatchObject({ categoryId: 'plumbing', urgency: 'urgent', status: 'draft' });

    const drafts = await api.getCustomerRequests({ section: 'drafts' });
    expect(drafts.items.map((request) => request.id)).toContain(draft.id);

    const published = await api.publishRequest(draft.id);
    expect(published.status).toBe('open');
    expect(notificationsOf(env, PRO_IDS.avi, 'new_matching_request', draft.id)).toHaveLength(1);
    expect((await expectApiError(api.updateDraftRequest(draft.id, { urgency: 'normal' }))).code).toBe('CONFLICT');
    expect((await expectApiError(api.deleteDraftRequest(draft.id))).code).toBe('CONFLICT');
    expect((await expectApiError(api.publishRequest(draft.id))).code).toBe('INVALID_STATE_TRANSITION');

    const second = await api.createRequest(payload({ publish: false }));
    await expect(api.deleteDraftRequest(second.id)).resolves.toEqual({ success: true });
    expect((await expectApiError(api.getRequestById(second.id))).status).toBe(404);
  });

  it('attaches uploaded photos and rejects unknown ones', async () => {
    const noa = env.as(NOA);
    const photo = await noa.uploads.uploadImage({ uri: 'file:///leak.jpg', mimeType: 'image/jpeg', width: 800, height: 600, fileName: 'leak.jpg' });
    expect(photo).toEqual({ id: expect.stringMatching(/^upl_/), url: `https://images.test/${photo.id}.jpg`, width: 1600, height: 1200 });
    const created = await noa.requests.createRequest(payload({ photoIds: [photo.id] }));
    expect(created.photos).toEqual([photo]);
    const error = await expectApiError(noa.requests.createRequest(payload({ photoIds: ['upl_missing'] })));
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(error.fieldErrors?.photoIds).toEqual(['validation:request.photoNotFound']);
    // Photos uploaded by someone else cannot be attached.
    const danielsPhoto = await env.as(DANIEL).uploads.uploadImage({ uri: 'file:///x.jpg', mimeType: null, width: null, height: null, fileName: null });
    expect((await expectApiError(noa.requests.createRequest(payload({ photoIds: [danielsPhoto.id] })))).status).toBe(400);
  });

  it('validates payloads with field errors', async () => {
    const api = env.as(NOA).requests;
    const invalid = await expectApiError(
      api.createRequest(payload({ description: 'too short', location: { ...florentin, addressLine: '' } })),
    );
    expect(invalid).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    expect(invalid.fieldErrors).toEqual({
      description: ['validation:request.descriptionTooShort'],
      'location.addressLine': ['validation:location.addressRequired'],
    });

    const unsupported = await expectApiError(
      api.createRequest({ ...payload(), categoryId: 'fortune_telling' } as unknown as CreateServiceRequestPayload),
    );
    expect(unsupported).toMatchObject({ status: 422, code: 'UNSUPPORTED_CATEGORY' });
    expect(unsupported.fieldErrors?.categoryId).toEqual(['validation:category.unsupported']);

    const past = await expectApiError(
      api.createRequest(payload({ preferredSchedule: { date: '2026-09-01', timeWindow: 'morning' } })),
    );
    expect(past.fieldErrors?.['preferredSchedule.date']).toEqual(['validation:request.preferredDateInPast']);
  });

  it('lists requests by section with customer view fields', async () => {
    const api = env.as(NOA).requests;
    const sections = {
      drafts: [SEED_IDS.requests.noaDraft],
      awaiting_offers: [SEED_IDS.requests.noaAc],
      has_offers: [SEED_IDS.requests.noaLeak],
      active: [SEED_IDS.requests.noaLighting],
      completed: [SEED_IDS.requests.noaWardrobe, SEED_IDS.requests.noaDishwasher],
      cancelled: [SEED_IDS.requests.noaKidsRoom],
    } as const;
    for (const [section, ids] of Object.entries(sections)) {
      const page = await api.getCustomerRequests({ section: section as keyof typeof sections });
      expect(page.items.map((request) => request.id).sort()).toEqual([...ids].sort());
    }
    const leak = (await api.getCustomerRequests({ section: 'has_offers' })).items[0];
    expect(leak.lowestOfferPrice).toBe(480);
    expect(leak.latestOfferAt).not.toBeNull();
    const all = await api.getCustomerRequests({ limit: 3 });
    expect(all.items).toHaveLength(3);
    expect(all.totalCount).toBe(7);
    const next = await api.getCustomerRequests({ limit: 3, cursor: all.nextCursor });
    expect(next.items.map((request) => request.id)).not.toContain(all.items[0].id);
  });

  it('cancels a request with pending offers and notifies the professionals', async () => {
    const cancelled = await env.as(NOA).requests.cancelRequest(SEED_IDS.requests.noaLeak, { reason: 'found_elsewhere' });
    expect(cancelled).toMatchObject({ status: 'cancelled', cancellationReason: 'found_elsewhere', pendingOfferCount: 0 });
    const offers = env.server.internals.db.offers.filter((offer) => offer.requestId === SEED_IDS.requests.noaLeak);
    expect(offers.every((offer) => offer.status === 'rejected' && offer.statusReason === 'request_cancelled')).toBe(true);
    for (const pro of [PRO_IDS.avi, PRO_IDS.yossi, PRO_IDS.eli]) {
      expect(notificationsOf(env, pro, 'request_cancelled', SEED_IDS.requests.noaLeak)).toHaveLength(1);
    }
    const again = await expectApiError(env.as(NOA).requests.cancelRequest(SEED_IDS.requests.noaLeak, { reason: 'other' }));
    expect(again).toMatchObject({ status: 409, code: 'INVALID_STATE_TRANSITION' });
  });

  it('cascades cancellation to the assigned job and closes its chat', async () => {
    await env.as(NOA).requests.cancelRequest(SEED_IDS.requests.noaLighting, { reason: 'scheduling_conflict', comment: 'Moving abroad' });
    const job = await env.as(NOA).jobs.getJobById(SEED_IDS.jobs.noaLighting);
    expect(job.status).toBe('cancelled');
    expect(job.cancelledAt).not.toBeNull();
    expect(notificationsOf(env, PRO_IDS.yael, 'request_cancelled', SEED_IDS.requests.noaLighting)).toHaveLength(1);
    const conversation = await env.as(PRO_IDS.yael).conversations.getConversationById(SEED_IDS.conversations.noaLighting);
    expect(conversation.isOpen).toBe(false);
    const send = await expectApiError(
      env.as(PRO_IDS.yael).conversations.sendMessage(SEED_IDS.conversations.noaLighting, { text: 'Hello?', clientMessageId: 'c1' }),
    );
    expect(send.code).toBe('CONFLICT');
    // The accepted offer stays accepted (terminal).
    expect(env.server.internals.db.offers.require(SEED_IDS.offers.lightingYael, 'Offer').status).toBe('accepted');
    // The customer's note for the pros is kept and shown to them on the request.
    const forYael = await env.as(PRO_IDS.yael).requests.getRequestById(SEED_IDS.requests.noaLighting);
    expect(forYael.request).toMatchObject({ status: 'cancelled', cancellationComment: 'Moving abroad' });
  });

  it('stores no cancellation comment when none was written', async () => {
    const cancelled = await env.as(NOA).requests.cancelRequest(SEED_IDS.requests.noaLeak, { reason: 'other', comment: '   ' });
    expect(cancelled.cancellationComment).toBeNull();
  });

  it('tells every matching professional when a request leaves the explorer', async () => {
    const updates: string[] = [];
    // Avi is a matching plumber who never sends an offer in this test.
    env.server.events.subscribe(PRO_IDS.avi, (event) => {
      if (event.type === 'request.updated') updates.push(event.requestId);
    });

    const toCancel = await env.as(NOA).requests.createRequest(payload());
    expect(updates).toEqual([toCancel.id]);
    await env.as(NOA).requests.cancelRequest(toCancel.id, { reason: 'other' });
    expect(updates).toEqual([toCancel.id, toCancel.id]);

    const toAccept = await env.as(NOA).requests.createRequest(payload());
    const offer = await env.as(PRO_IDS.yossi).offers.createOffer(toAccept.id, {
      price: 350,
      currency: 'ILS',
      proposedStartAt: minutesFromNow(env, 24 * 60),
      estimatedDurationMinutes: 60,
      message: null,
    });
    updates.length = 0;
    await env.as(NOA).offers.acceptOffer(offer.id);
    expect(updates).toEqual([toAccept.id]);
  });

  it('does not allow cancelling work in progress', async () => {
    const error = await expectApiError(env.as(DANIEL).requests.cancelRequest(SEED_IDS.requests.danielWifi, { reason: 'other' }));
    expect(error).toMatchObject({ status: 409, code: 'INVALID_STATE_TRANSITION' });
  });

  it('rejects a preferred date the urgency does not allow any offer to use', async () => {
    const nextWeek = new Date(Date.parse(minutesFromNow(env, 7 * 24 * 60)));
    const dateKey = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;
    const error = await expectApiError(
      env.as(NOA).requests.createRequest(payload({ urgency: 'emergency', preferredSchedule: { date: dateKey, timeWindow: 'any' } })),
    );
    expect(error.fieldErrors?.['preferredSchedule.date']).toEqual(['validation:request.preferredDateBeyondUrgency']);

    // A draft that was fine becomes invalid when only its urgency is raised.
    const draft = await env.as(NOA).requests.createRequest(
      payload({ publish: false, urgency: 'normal', preferredSchedule: { date: dateKey, timeWindow: 'any' } }),
    );
    const raised = await expectApiError(env.as(NOA).requests.updateDraftRequest(draft.id, { urgency: 'urgent' }));
    expect(raised.fieldErrors?.['preferredSchedule.date']).toEqual(['validation:request.preferredDateBeyondUrgency']);
  });

  it('validates the preferred date against the server clock at publish time', async () => {
    const draft = await env.as(NOA).requests.createRequest(
      payload({ publish: false, preferredSchedule: { date: '2026-09-28', timeWindow: 'any' } }),
    );
    env.clock.set(new Date(Date.parse(minutesFromNow(env, 3 * 24 * 60))));
    const error = await expectApiError(env.as(NOA).requests.publishRequest(draft.id));
    expect(error.fieldErrors?.['preferredSchedule.date']).toEqual(['validation:request.preferredDateInPast']);
  });
});
