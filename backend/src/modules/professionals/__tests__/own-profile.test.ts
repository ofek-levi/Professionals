import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createCustomer, createUpload } from '../../../../test/factories.js';
import { UploadModel } from '../../uploads/upload.model.js';
import { UserModel } from '../../users/user.model.js';
import { ProfessionalModel } from '../professional.model.js';

const WORKDAY = { enabled: true, start: '08:00', end: '17:00' };
const DAY_OFF = { enabled: false, start: '09:00', end: '17:00' };

/** What the app's profile form sends (`toUpdateProfessionalProfilePayload`). */
function fullPayload() {
  return {
    fullName: 'Avi  Ben David',
    displayName: 'Avi Plumbing',
    headline: 'Leaks fixed the same day',
    bio: 'Licensed plumber with fifteen years of experience in Tel Aviv homes.',
    categoryIds: ['plumbing', 'water_heater', 'plumbing'],
    yearsOfExperience: 15,
    serviceArea: { center: { latitude: 32.08, longitude: 34.78 }, radiusKm: 25, label: 'Tel Aviv' },
    baseLocation: {
      coordinates: { latitude: 32.081, longitude: 34.781 },
      addressLine: 'Ibn Gabirol St 60',
      city: 'Tel Aviv-Yafo',
      neighborhood: null,
      details: null,
      isApproximate: false,
    },
    availability: { days: { sun: WORKDAY, mon: WORKDAY, tue: WORKDAY, wed: WORKDAY, thu: WORKDAY, fri: DAY_OFF, sat: DAY_OFF }, acceptsEmergencyCalls: true },
    contact: { phone: '0527654321', email: 'Office@AviPlumbing.co.il', website: 'aviplumbing.co.il' },
    business: { businessName: 'Avi Plumbing Ltd', licenseNumber: 'TA-1234', isInsured: true, languages: ['HE', 'en', 'he'] },
    startingPrice: { amount: 250, currency: 'ILS' },
    notificationPreferences: { pushEnabled: true, emailEnabled: false, jobUpdates: true, messages: true, newRequests: false, reminders: true },
  };
}

describe('GET /v1/professional/profile', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('returns the complete own profile', async () => {
    const pro = await signInProfessional(deps);
    const res = await request(app).get('/v1/professional/profile').set(pro.headers).expect(200);
    expect(res.body).toMatchObject({
      id: pro.user._id.toHexString(),
      userId: pro.user._id.toHexString(),
      fullName: `${pro.user.firstName} ${pro.user.lastName}`,
      contact: pro.professional.contact,
      notificationPreferences: pro.user.notificationPreferences,
      baseLocation: { addressLine: 'Ibn Gabirol St 50', isApproximate: false },
      serviceArea: { center: { latitude: 32.0853, longitude: 34.7818 }, radiusKm: 20, label: 'Tel Aviv-Yafo' },
      memberSince: pro.professional.createdAt.toISOString(),
    });
  });

  it('is only for professionals', async () => {
    await request(app).get('/v1/professional/profile').expect(401);
    const customer = await signInCustomer(deps);
    await request(app).get('/v1/professional/profile').set(customer.headers).expect(403);
    await request(app).patch('/v1/professional/profile').set(customer.headers).send({ bio: 'x' }).expect(403);
  });
});

describe('PATCH /v1/professional/profile', () => {
  const { app, deps } = createTestApp();
  beforeEach(clearDatabase);

  it('saves the whole form and keeps the account in sync', async () => {
    const pro = await signInProfessional(deps);
    deps.clock.advanceMinutes(10);
    const res = await request(app).patch('/v1/professional/profile').set(pro.headers).send(fullPayload()).expect(200);

    expect(res.body).toMatchObject({
      fullName: 'Avi Ben David',
      displayName: 'Avi Plumbing',
      categoryIds: ['plumbing', 'water_heater'],
      serviceArea: { center: { latitude: 32.08, longitude: 34.78 }, radiusKm: 25, label: 'Tel Aviv' },
      baseLocation: { addressLine: 'Ibn Gabirol St 60', isApproximate: false },
      availability: { acceptsEmergencyCalls: true, days: { fri: DAY_OFF } },
      contact: { phone: '0527654321', email: 'office@aviplumbing.co.il', website: 'https://aviplumbing.co.il' },
      business: { businessName: 'Avi Plumbing Ltd', licenseNumber: 'TA-1234', isInsured: true, languages: ['he', 'en'] },
      startingPrice: { amount: 250, currency: 'ILS' },
      notificationPreferences: { newRequests: false },
      updatedAt: deps.clock.now().toISOString(),
    });
    const user = await UserModel.findById(pro.user._id).lean();
    expect(user).toMatchObject({ firstName: 'Avi', lastName: 'Ben David', phone: '0527654321', email: pro.user.email });
    expect(user?.notificationPreferences.newRequests).toBe(false);
    const stored = await ProfessionalModel.findById(pro.user._id).lean();
    expect(stored?.serviceArea.center).toEqual({ type: 'Point', coordinates: [34.78, 32.08] });
    expect(deps.realtime.eventsFor(pro.user._id.toHexString())).toContainEqual({ type: 'profile.updated', professionalId: pro.user._id.toHexString() });

    const again = await request(app).get('/v1/professional/profile').set(pro.headers).expect(200);
    expect(again.body).toEqual(res.body);
  });

  it('changes only what was sent', async () => {
    const pro = await signInProfessional(deps);
    const before = await UserModel.findById(pro.user._id).lean();
    const res = await request(app).patch('/v1/professional/profile').set(pro.headers).send({ headline: 'Emergency plumbing 24/7', baseLocation: null }).expect(200);
    expect(res.body).toMatchObject({ headline: 'Emergency plumbing 24/7', baseLocation: null, bio: pro.professional.bio, contact: pro.professional.contact });
    expect(await UserModel.findById(pro.user._id).lean()).toEqual(before);
  });

  it('validates every field with the app’s message keys', async () => {
    const pro = await signInProfessional(deps);
    const payload = fullPayload();
    const res = await request(app)
      .patch('/v1/professional/profile')
      .set(pro.headers)
      .send({
        ...payload,
        fullName: 'Avi',
        bio: 'Too short',
        categoryIds: [],
        yearsOfExperience: 2.5,
        serviceArea: { ...payload.serviceArea, radiusKm: 1 },
        availability: { ...payload.availability, days: { ...payload.availability.days, mon: { enabled: true, start: '18:00', end: '08:00' }, tue: { enabled: true, start: '8am', end: '17:00' } } },
        contact: { phone: '123', email: 'nope', website: 'not a website' },
        business: { ...payload.business, licenseNumber: '#', languages: [] },
        startingPrice: { amount: 5, currency: 'GBP' },
      })
      .expect(400);
    expect(res.body.fieldErrors).toEqual({
      fullName: ['validation:profile.fullNameTooShort'],
      bio: ['validation:profile.bioTooShort'],
      categoryIds: ['validation:category.minOne'],
      yearsOfExperience: ['validation:profile.yearsInvalid'],
      'serviceArea.radiusKm': ['validation:profile.radiusTooSmall'],
      'availability.days.mon.end': ['validation:profile.availabilityEndBeforeStart'],
      'availability.days.tue.start': ['validation:profile.timeInvalid'],
      'contact.phone': ['validation:profile.phoneInvalid'],
      'contact.email': ['validation:profile.emailInvalid'],
      'contact.website': ['validation:profile.websiteInvalid'],
      'business.licenseNumber': ['validation:profile.licenseNumberInvalid'],
      'business.languages': ['validation:profile.languagesRequired'],
      'startingPrice.amount': ['validation:offer.priceTooLow'],
      'startingPrice.currency': ['validation:offer.currencyUnsupported'],
    });

    const noDays = await request(app)
      .patch('/v1/professional/profile')
      .set(pro.headers)
      .send({ availability: { days: Object.fromEntries(Object.keys(payload.availability.days).map((day) => [day, DAY_OFF])), acceptsEmergencyCalls: false } })
      .expect(400);
    expect(noDays.body.fieldErrors).toEqual({ 'availability.days': ['validation:profile.availabilityNoDays'] });
  });

  it('answers 422 for categories outside the catalog', async () => {
    const pro = await signInProfessional(deps);
    const res = await request(app).patch('/v1/professional/profile').set(pro.headers).send({ categoryIds: ['plumbing', 'astrology'] }).expect(422);
    expect(res.body).toMatchObject({ code: 'UNSUPPORTED_CATEGORY', fieldErrors: { 'categoryIds.1': ['validation:category.unsupported'] } });
  });

  it('takes the avatar from the professional’s own uploads', async () => {
    const pro = await signInProfessional(deps);
    const mine = await createUpload(pro.user);
    const res = await request(app).patch('/v1/professional/profile').set(pro.headers).send({ avatarUrl: mine.url }).expect(200);
    expect(res.body.avatarUrl).toBe(mine.url);
    expect((await UploadModel.findById(mine._id).lean())?.attachedAt).not.toBeNull();

    const foreign = await createUpload(await createCustomer());
    const rejected = await request(app).patch('/v1/professional/profile').set(pro.headers).send({ avatarUrl: foreign.url, headline: 'New headline' }).expect(400);
    expect(rejected.body.fieldErrors).toEqual({ avatarUrl: ['validation:invalid'] });
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.headline).toBe(pro.professional.headline);
  });
});
