import { DEMO_CUSTOMER_IDS, PRO_IDS, SEED_IDS } from '../data/seed';
import { createTestEnvironment, expectApiError, minutesFromNow, type TestEnvironment } from '../testing/test-server';

const NOA = DEMO_CUSTOMER_IDS.noa;
const DANIEL = DEMO_CUSTOMER_IDS.daniel;

describe('authentication and role separation', () => {
  let env: TestEnvironment;
  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  it('serves public endpoints anonymously and protects everything else', async () => {
    const anonymous = env.as(null);
    await expect(anonymous.auth.getDemoAccounts()).resolves.toHaveLength(8);
    await expect(anonymous.catalog.getProfessionalCategories()).resolves.toMatchObject({ version: expect.any(String) });
    expect(await expectApiError(anonymous.auth.getCurrentUser())).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(await expectApiError(anonymous.requests.getRequestById(SEED_IDS.requests.noaLeak))).toMatchObject({ status: 401 });
    expect(await expectApiError(env.as('user_nobody').auth.getCurrentUser())).toMatchObject({ status: 401 });
    // Public endpoints ignore stale tokens.
    await expect(env.as('user_nobody').auth.getDemoAccounts()).resolves.toHaveLength(8);
    await expect(env.as('user_nobody').auth.logout()).resolves.toEqual({ success: true });
  });

  it('signs in demo accounts with demo tokens', async () => {
    const session = await env.as(null).auth.demoLogin({ userId: PRO_IDS.avi });
    expect(session.accessToken).toBe(`demo-token:${PRO_IDS.avi}`);
    expect(session.user).toMatchObject({ id: PRO_IDS.avi, role: 'professional', displayName: 'AquaFix Plumbing' });
    expect(session.user).not.toHaveProperty('isDemo');
    expect(await expectApiError(env.as(null).auth.demoLogin({ userId: 'user_tamar_shalev' }))).toMatchObject({ status: 404 });
    expect(await expectApiError(env.as(null).auth.demoLogin({ userId: '' }))).toMatchObject({ status: 422 });

    const me = await env.as(PRO_IDS.avi).auth.getCurrentUser();
    expect(me.user.role).toBe('professional');
    expect(me.professionalProfile?.notificationPreferences).toBeDefined();
    const customer = await env.as(NOA).auth.getCurrentUser();
    expect(customer.customerProfile?.userId).toBe(NOA);
    expect(customer.professionalProfile).toBeNull();
  });

  it('forbids customers from professional endpoints', async () => {
    const noa = env.as(NOA);
    expect(await expectApiError(noa.requests.getNearbyOpenRequests())).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(await expectApiError(noa.offers.getProfessionalOffers())).toMatchObject({ status: 403 });
    expect(await expectApiError(noa.dashboard.getProfessionalDashboard())).toMatchObject({ status: 403 });
    expect(await expectApiError(noa.professionals.getOwnProfessionalProfile())).toMatchObject({ status: 403 });
    expect(
      await expectApiError(
        noa.offers.createOffer('req_tamar_sink', {
          price: 300,
          currency: 'ILS',
          proposedStartAt: minutesFromNow(env, 120),
          estimatedDurationMinutes: null,
          message: null,
        }),
      ),
    ).toMatchObject({ status: 403 });
  });

  it('forbids professionals from customer endpoints', async () => {
    const avi = env.as(PRO_IDS.avi);
    expect(await expectApiError(avi.offers.acceptOffer(SEED_IDS.offers.leakAvi))).toMatchObject({ status: 403 });
    expect(await expectApiError(avi.dashboard.getCustomerDashboard())).toMatchObject({ status: 403 });
    expect(await expectApiError(avi.requests.getCustomerRequests())).toMatchObject({ status: 403 });
    expect(await expectApiError(avi.requests.cancelRequest(SEED_IDS.requests.noaLeak, { reason: 'other' }))).toMatchObject({
      status: 403,
    });
  });

  it('hides the exact address from professionals until they are hired', async () => {
    const response = await env.as(PRO_IDS.avi).requests.getRequestById(SEED_IDS.requests.noaLeak);
    expect(response.viewerRole).toBe('professional');
    if (response.viewerRole !== 'professional') return;
    const real = env.server.internals.db.requests.require(SEED_IDS.requests.noaLeak, 'Request').location;
    expect(response.request.location).toMatchObject({ addressLine: '', details: null, isApproximate: true, city: real.city });
    expect(response.request.location.coordinates).not.toEqual(real.coordinates);
    expect(response.request.customer).toMatchObject({ displayName: 'Noa L.', id: NOA });
    expect(response.request.isMatch).toBe(true);
    expect(JSON.stringify(response)).not.toContain('Florentin St 24');
    expect(JSON.stringify(response)).not.toContain('Apartment 7');
    // The customer's notes carry access details (codes, parking), so they are private too.
    expect(response.request.notes).toBeNull();

    const nearby = await env.as(PRO_IDS.avi).requests.getNearbyOpenRequests();
    expect(JSON.stringify(nearby)).not.toContain('Florentin St 24');
    expect(JSON.stringify(nearby)).not.toContain('stairwell cabinet');
    const dashboard = await env.as(PRO_IDS.avi).dashboard.getProfessionalDashboard();
    expect(JSON.stringify(dashboard)).not.toContain('stairwell cabinet');

    // The hired professional sees everything.
    const hired = await env.as(PRO_IDS.lior).requests.getRequestById(SEED_IDS.requests.danielWifi);
    expect(hired.request.location).toMatchObject({ isApproximate: false, addressLine: 'Bialik St 45' });

    // Once hired, the professional also gets the notes; the owner always does.
    const noa = env.as(NOA);
    await noa.offers.acceptOffer(SEED_IDS.offers.leakAvi);
    const afterHire = await env.as(PRO_IDS.avi).requests.getRequestById(SEED_IDS.requests.noaLeak);
    expect(afterHire.request.notes).toContain('stairwell cabinet');
    const other = await env.as(PRO_IDS.eli).requests.getRequestById(SEED_IDS.requests.noaLeak);
    expect(other.request.notes).toBeNull();
    const own = await noa.requests.getRequestById(SEED_IDS.requests.noaLeak);
    expect(own.request.notes).toContain('stairwell cabinet');
  });

  it('limits which requests a professional or customer can open', async () => {
    // Yael is an electrician: Noa's plumbing request is neither a match nor has her offer.
    expect(await expectApiError(env.as(PRO_IDS.yael).requests.getRequestById(SEED_IDS.requests.noaLeak))).toMatchObject({
      status: 403,
    });
    expect(await expectApiError(env.as(PRO_IDS.eli).requests.getRequestById(SEED_IDS.requests.noaDraft))).toMatchObject({
      status: 404,
    });
    expect(await expectApiError(env.as(DANIEL).requests.getRequestById(SEED_IDS.requests.noaLeak))).toMatchObject({ status: 403 });
    const own = await env.as(NOA).requests.getRequestById(SEED_IDS.requests.noaLeak);
    expect(own.viewerRole).toBe('customer');
    expect(own.request.location.addressLine).toBe('Florentin St 24');
  });

  it('strips private settings from public professional profiles', async () => {
    const profile = await env.as(NOA).professionals.getProfessionalProfile(PRO_IDS.avi);
    expect(profile).not.toHaveProperty('notificationPreferences');
    expect(profile.stats.reviewCount).toBeGreaterThan(0);
    const own = await env.as(PRO_IDS.avi).professionals.getOwnProfessionalProfile();
    expect(own.notificationPreferences).toBeDefined();
    expect(await expectApiError(env.as(NOA).professionals.getProfessionalProfile('pro_missing'))).toMatchObject({ status: 404 });
  });

  it('shows a professional’s contact details only to customers who hired them, and never the exact base', async () => {
    const db = env.server.internals.db;
    const own = await env.as(PRO_IDS.avi).professionals.getOwnProfessionalProfile();
    const hiredBy = db.jobs.find((job) => job.professionalId === own.id)?.customerId;
    const stranger = db.users.find((user) => user.role === 'customer' && !db.jobs.find((job) => job.professionalId === own.id && job.customerId === user.id));
    expect(hiredBy).toBeDefined();
    expect(stranger).toBeDefined();
    if (!hiredBy || !stranger) return;

    const publicView = await env.as(stranger.id).professionals.getProfessionalProfile(own.id);
    expect(publicView.contact).toBeNull();
    expect(publicView.baseLocation).toMatchObject({ isApproximate: true, addressLine: '', details: null });
    expect(publicView.baseLocation?.coordinates).not.toEqual(own.baseLocation?.coordinates);
    expect(publicView.serviceArea.center).not.toEqual(own.serviceArea.center);
    expect(publicView.serviceArea.radiusKm).toBe(own.serviceArea.radiusKm);

    await expect(env.as(hiredBy).professionals.getProfessionalProfile(own.id)).resolves.toMatchObject({ contact: own.contact });
    // Other professionals don't get them either.
    expect((await env.as(PRO_IDS.eli).professionals.getProfessionalProfile(own.id)).contact).toBeNull();
  });
});
