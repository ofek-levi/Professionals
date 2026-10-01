import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestDeps } from '../../../../test/app.js';
import { createCustomer, createJob, createOffer, createProfessional, createRequest } from '../../../../test/factories.js';
import { fromGeoPoint, haversineDistanceKm, setLocationPrivacySecret } from '../../../lib/geo.js';
import { loadCustomerSummaries } from '../../customers/customer-summary.views.js';
import { loadUserDisplays } from '../../users/user-display.views.js';
import { loadProfessionalSummaries, toOwnProfessionalProfile, toPublicProfessionalProfile } from '../professional.views.js';

describe('shared views', () => {
  const deps = createTestDeps();
  beforeEach(clearDatabase);

  it('public profiles hide the exact base and the contact; the own profile is complete', async () => {
    const { user, professional } = await createProfessional({ user: { avatar: { url: 'https://img.test/a.jpg', publicId: 'a' } } });
    const own = toOwnProfessionalProfile(professional, user);
    expect(own).toMatchObject({
      id: user._id.toHexString(),
      userId: user._id.toHexString(),
      fullName: `${user.firstName} ${user.lastName}`,
      avatarUrl: 'https://img.test/a.jpg',
      contact: professional.contact,
      notificationPreferences: user.notificationPreferences,
      baseLocation: { addressLine: 'Ibn Gabirol St 50', isApproximate: false },
      stats: { averageRating: null, reviewCount: 0, completedJobsCount: 0, responseTimeMinutes: null },
    });

    const stranger = toPublicProfessionalProfile(professional, user, { isOwner: false, hiredByViewer: false });
    expect(stranger).not.toHaveProperty('notificationPreferences');
    expect(stranger).not.toHaveProperty('fullName');
    expect(stranger.contact).toBeNull();
    expect(stranger.baseLocation).toMatchObject({ addressLine: '', details: null, isApproximate: true, city: 'Tel Aviv-Yafo' });
    const shift = haversineDistanceKm(own.serviceArea.center, stranger.serviceArea.center);
    expect(shift).toBeGreaterThan(0.2);
    expect(shift).toBeLessThan(0.5);
    // Deterministic: every viewer gets the same approximate point, the stored one (also for the
    // base, which is the area's center), whatever key is installed now.
    expect(stranger.serviceArea.center).toEqual(fromGeoPoint(professional.serviceArea.publicCenter));
    expect(stranger.baseLocation?.coordinates).toEqual(stranger.serviceArea.center);
    expect(toPublicProfessionalProfile(professional, user, { isOwner: false, hiredByViewer: false })).toEqual(stranger);
    try {
      setLocationPrivacySecret('Zt3Mq8Wv1Ke6Ry0Pn5Lx2Hj9Sd4Gb7Fc1Ua6Io3Pe8Tk');
      expect(toPublicProfessionalProfile(professional, user, { isOwner: false, hiredByViewer: false })).toEqual(stranger);
    } finally {
      setLocationPrivacySecret(deps.env.locationPrivacySecret);
    }

    expect(toPublicProfessionalProfile(professional, user, { isOwner: false, hiredByViewer: true }).contact).toEqual(professional.contact);
    const self = toPublicProfessionalProfile(professional, user, { isOwner: true, hiredByViewer: false });
    expect(self.baseLocation?.isApproximate).toBe(false);
    expect(self).not.toHaveProperty('notificationPreferences');
    expect(self).not.toHaveProperty('fullName');
  });

  it('batch loaders resolve summaries and display names for a page at once', async () => {
    const customer = await createCustomer({ firstName: 'Noa', lastName: 'Levi' });
    const { user: proUser, professional } = await createProfessional({ professional: { displayName: 'Avi Plumbing' } });
    const request = await createRequest(customer);
    const offer = await createOffer(request, professional);
    await createJob(request, offer, { status: 'completed' });

    const professionals = await loadProfessionalSummaries([professional._id, professional._id]);
    expect(professionals.get(professional._id.toHexString())).toMatchObject({ displayName: 'Avi Plumbing', city: 'Tel Aviv-Yafo', averageRating: null });

    const customers = await loadCustomerSummaries([customer._id]);
    expect(customers.get(customer._id.toHexString())).toMatchObject({ displayName: 'Noa L.', completedJobsCount: 1 });
    // Not the customer's home city: professionals see the request's own location.
    expect(customers.get(customer._id.toHexString())).not.toHaveProperty('city');

    const displays = await loadUserDisplays([customer._id, proUser._id]);
    expect(displays.get(customer._id.toHexString())).toMatchObject({ role: 'customer', displayName: 'Noa Levi', shortName: 'Noa L.' });
    expect(displays.get(proUser._id.toHexString())).toMatchObject({ role: 'professional', displayName: 'Avi Plumbing', shortName: 'Avi Plumbing' });
  });
});
