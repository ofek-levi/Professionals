import type { CreateOfferPayload } from '@/types/api';

import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, minutesFromNow, type TestEnvironment } from '../testing/test-server';

const AVI = PRO_IDS.avi;
const TAMAR_SINK = 'req_tamar_sink'; // emergency plumbing request in Ramat Aviv, no offers yet

describe('offers', () => {
  let env: TestEnvironment;
  const offer = (overrides: Partial<CreateOfferPayload> = {}): CreateOfferPayload => ({
    price: 420,
    currency: 'ILS',
    proposedStartAt: minutesFromNow(env, 90),
    estimatedDurationMinutes: 60,
    message: 'I can be there within the hour and a half.',
    ...overrides,
  });
  const notificationsOf = (userId: string, type: string) =>
    env.server.internals.db.notifications.filter((notification) => notification.userId === userId && notification.type === type);

  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('submits an offer (happy path)', async () => {
    const created = await env.as(AVI).offers.createOffer(TAMAR_SINK, offer());
    expect(created).toMatchObject({ requestId: TAMAR_SINK, professionalId: AVI, status: 'pending', price: 420, statusReason: null });
    // Emergency offers stay valid for 6 hours, but never past the proposed start.
    expect(created.expiresAt).toBe(created.proposedStartAt);

    const request = env.server.internals.db.requests.require(TAMAR_SINK, 'Request');
    expect(request).toMatchObject({ status: 'offers_received', offerCount: 1, pendingOfferCount: 1 });
    const [received] = notificationsOf('user_tamar_shalev', 'offer_received');
    expect(received).toMatchObject({
      params: { professionalName: 'AquaFix Plumbing', price: 420, currency: 'ILS', categoryId: 'plumbing' },
      target: { kind: 'offer', offerId: created.id, requestId: TAMAR_SINK },
    });

    const view = await env.as(AVI).requests.getRequestById(TAMAR_SINK);
    expect(view.viewerRole === 'professional' && view.request.myOffer).toMatchObject({ offerId: created.id, status: 'pending' });
    const mine = await env.as(AVI).offers.getProfessionalOffers({ statuses: ['pending'] });
    expect(mine.items.map((item) => item.id)).toContain(created.id);
    expect(mine.items.find((item) => item.id === created.id)?.request.location.isApproximate).toBe(true);
  });

  it('rejects a duplicate active offer but allows a new one after withdrawing', async () => {
    const first = await env.as(AVI).offers.createOffer(TAMAR_SINK, offer());
    const duplicate = await expectApiError(env.as(AVI).offers.createOffer(TAMAR_SINK, offer({ price: 380 })));
    expect(duplicate).toMatchObject({ status: 409, code: 'DUPLICATE_OFFER' });

    const withdrawn = await env.as(AVI).offers.withdrawOffer(first.id);
    expect(withdrawn).toMatchObject({ status: 'withdrawn', statusReason: 'withdrawn_by_professional' });
    const request = env.server.internals.db.requests.require(TAMAR_SINK, 'Request');
    // Withdrawn offers do not count, and the request is open again.
    expect(request).toMatchObject({ status: 'open', offerCount: 0, pendingOfferCount: 0 });
    expect(notificationsOf('user_tamar_shalev', 'offer_withdrawn')).toHaveLength(1);

    const second = await env.as(AVI).offers.createOffer(TAMAR_SINK, offer({ price: 380 }));
    expect(second.status).toBe('pending');
    expect((await expectApiError(env.as(AVI).offers.withdrawOffer(first.id))).code).toBe('INVALID_STATE_TRANSITION');
  });

  it('rejects professionals outside the service area or category', async () => {
    // Dana (handyman, 12 km around Florentin) cannot quote on a heavy-lifting job in Hod HaSharon…
    const wrongCategory = await expectApiError(env.as(PRO_IDS.dana).offers.createOffer('req_adi_piano', offer({ price: 600 })));
    expect(wrongCategory).toMatchObject({ status: 422, code: 'UNSUPPORTED_CATEGORY' });
    expect(wrongCategory.fieldErrors?.categoryId).toEqual(['validation:category.notOffered']);

    // …and Avi (plumber, 20 km) cannot quote on a plumbing job far outside his area.
    const farAway = await env.as(DEMO_CUSTOMER_IDS.daniel).requests.createRequest({
      categoryId: 'plumbing',
      description: 'Replace a leaking kitchen faucet in Rehovot.',
      location: { coordinates: { latitude: 31.87, longitude: 34.815 }, addressLine: 'Herzl St 1', city: 'Rehovot', neighborhood: null, details: null },
      urgency: 'normal',
      preferredSchedule: null,
      photoIds: [],
      notes: null,
      publish: true,
    });
    const outside = await expectApiError(env.as(AVI).offers.createOffer(farAway.id, offer()));
    expect(outside).toMatchObject({ status: 422, code: 'OUTSIDE_SERVICE_AREA' });
    expect(outside.fieldErrors?.location).toEqual(['validation:location.outsideServiceArea']);
  });

  it('rejects offers on requests that no longer accept offers', async () => {
    const closed = await expectApiError(env.as(PRO_IDS.omer).offers.createOffer(SEED_IDS.requests.noaLighting, offer()));
    expect(closed).toMatchObject({ status: 409, code: 'REQUEST_NOT_ACCEPTING_OFFERS' });
    const cancelled = await expectApiError(env.as(PRO_IDS.anat).offers.createOffer(SEED_IDS.requests.noaKidsRoom, offer()));
    expect(cancelled.code).toBe('REQUEST_NOT_ACCEPTING_OFFERS');
    // Drafts are invisible to professionals.
    const draft = await expectApiError(env.as(PRO_IDS.eli).offers.createOffer(SEED_IDS.requests.noaDraft, offer()));
    expect(draft.status).toBe(404);
  });

  it('rejects invalid prices and proposed times', async () => {
    const tooSoon = await expectApiError(env.as(AVI).offers.createOffer(TAMAR_SINK, offer({ proposedStartAt: minutesFromNow(env, 10) })));
    expect(tooSoon).toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
    expect(tooSoon.fieldErrors).toEqual({ proposedStartAt: ['validation:offer.startTooSoon'] });

    const emergencyWindow = await expectApiError(
      env.as(AVI).offers.createOffer(TAMAR_SINK, offer({ proposedStartAt: minutesFromNow(env, 30 * 60) })),
    );
    expect(emergencyWindow.fieldErrors).toEqual({ proposedStartAt: ['validation:offer.emergencyWindow'] });

    const badPayload = await expectApiError(env.as(AVI).offers.createOffer(TAMAR_SINK, offer({ price: 5, estimatedDurationMinutes: 3 })));
    expect(badPayload.fieldErrors).toEqual({
      price: ['validation:offer.priceTooLow'],
      estimatedDurationMinutes: ['validation:offer.durationInvalid'],
    });
    const currency = await expectApiError(env.as(AVI).offers.createOffer(TAMAR_SINK, offer({ currency: 'USD' })));
    expect(currency.fieldErrors).toEqual({ currency: ['validation:offer.currencyUnsupported'] });
    expect(env.server.internals.db.offers.count((candidate) => candidate.requestId === TAMAR_SINK)).toBe(0);
  });

  it('edits a pending offer and notifies the customer', async () => {
    const updated = await env.as(AVI).offers.updateOffer(SEED_IDS.offers.leakAvi, { price: 600, message: 'Updated: includes tiling.' });
    expect(updated).toMatchObject({ price: 600, message: 'Updated: includes tiling.', status: 'pending' });
    expect(Date.parse(updated.expiresAt)).toBeGreaterThan(env.clock.now().getTime());
    expect(notificationsOf(DEMO_CUSTOMER_IDS.noa, 'offer_updated')).toHaveLength(1);
    const forbidden = await expectApiError(env.as(PRO_IDS.yossi).offers.updateOffer(SEED_IDS.offers.leakAvi, { price: 1 }));
    expect(forbidden).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    const invalid = await expectApiError(
      env.as(AVI).offers.updateOffer(SEED_IDS.offers.leakAvi, { proposedStartAt: minutesFromNow(env, 5) }),
    );
    expect(invalid.fieldErrors?.proposedStartAt).toEqual(['validation:offer.startTooSoon']);
    const accepted = await expectApiError(env.as(PRO_IDS.yael).offers.updateOffer(SEED_IDS.offers.lightingYael, { price: 1000 }));
    expect(accepted.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('lists offers for the owner, sorted and filtered', async () => {
    const api = env.as(DEMO_CUSTOMER_IDS.noa).offers;
    const byPrice = await api.getOffersForRequest(SEED_IDS.requests.noaLeak, { sort: 'lowest_price' });
    expect(byPrice.map((item) => item.price)).toEqual([480, 550, 650]);
    expect(byPrice[0].professional.displayName).toBe('Peretz Plumbing & Heating');
    expect(byPrice[0].distanceKm).toBeGreaterThan(0);
    const recommended = await api.getOffersForRequest(SEED_IDS.requests.noaLeak);
    expect(recommended).toHaveLength(3);
    const lighting = await api.getOffersForRequest(SEED_IDS.requests.noaLighting, { sort: 'lowest_price' });
    expect(lighting.map((item) => item.status)).toEqual(['accepted', 'rejected']);
    const onlyRejected = await api.getOffersForRequest(SEED_IDS.requests.noaLighting, { statuses: ['rejected'] });
    expect(onlyRejected).toHaveLength(1);
    expect((await expectApiError(env.as(DEMO_CUSTOMER_IDS.daniel).offers.getOffersForRequest(SEED_IDS.requests.noaLeak))).status).toBe(403);
  });

  it('shows offer details to the request owner and the offering professional only', async () => {
    const asOwner = await env.as(DEMO_CUSTOMER_IDS.noa).offers.getOfferById(SEED_IDS.offers.leakAvi);
    expect(asOwner.request.location).toMatchObject({ isApproximate: false, addressLine: 'Florentin St 24' });
    const asPro = await env.as(AVI).offers.getOfferById(SEED_IDS.offers.leakAvi);
    expect(asPro.request.location).toMatchObject({ isApproximate: true, addressLine: '', details: null });
    expect((await expectApiError(env.as(PRO_IDS.yossi).offers.getOfferById(SEED_IDS.offers.leakAvi))).status).toBe(403);
    expect((await expectApiError(env.as(DEMO_CUSTOMER_IDS.daniel).offers.getOfferById(SEED_IDS.offers.leakAvi))).status).toBe(403);
  });
});
