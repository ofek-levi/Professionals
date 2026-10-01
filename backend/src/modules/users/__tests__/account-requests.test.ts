/** The operator's tools for privacy requests by email: export an account, change its sign-in email, list every address. */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createPushSession, createRequest } from '../../../../test/factories.js';
import { JPEG } from '../../../../test/images.js';
import { EmailTokenModel } from '../../auth/email-token.model.js';
import { SessionModel } from '../../auth/session.model.js';
import { STRONG_PASSWORD } from '../../auth/__tests__/auth-test-helpers.js';
import { hashPassword } from '../../auth/passwords.js';
import { NotificationModel } from '../../notifications/notification.model.js';
import { ProfessionalModel } from '../../professionals/professional.model.js';
import { activeAccountEmailsCsv } from '../account-emails.service.js';
import { deleteAccountOf } from '../account-deletion.service.js';
import { exportAccount } from '../account-export.service.js';
import { changeSignInEmail } from '../sign-in-email.service.js';
import { UserModel } from '../user.model.js';

describe('privacy requests: the operator tools', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(async () => {
    await clearDatabase();
    deps.mailer.sent.length = 0;
  });

  async function photo(folder: string) {
    const image = await deps.storage.upload({ buffer: JPEG, mimeType: 'image/jpeg', folder });
    return { url: image.url, publicId: image.publicId };
  }

  it('exports everything stored about a customer, without passwords, Google ids or token hashes', async () => {
    const avatar = await photo('avatars');
    const customer = await signInCustomer(deps, { email: 'noa@example.com', passwordHash: 'argon-hash', googleSub: 'google-noa', avatar });
    const pro = await signInProfessional(deps);
    const requestPhoto = await photo('requests');
    const done = await createRequest(customer.user, { status: 'completed', photos: [requestPhoto] });
    const offer = await createOffer(done, pro.professional, { status: 'accepted' });
    const job = await createJob(done, offer, { status: 'completed', completedAt: deps.clock.now() });
    await request(app).post(`/v1/jobs/${job._id.toHexString()}/review`).set(customer.headers).send({ rating: 5, comment: 'Great' }).expect(201);
    const chat = job.conversation.toHexString();
    await request(app).post(`/v1/conversations/${chat}/messages`).set(customer.headers).send({ text: 'Thanks!', clientMessageId: 'c-1' }).expect(201);
    await request(app).post(`/v1/conversations/${chat}/messages`).set(pro.headers).send({ text: 'Anytime', clientMessageId: 'p-1' }).expect(201);
    await createPushSession(customer.user);
    await EmailTokenModel.create({ user: customer.user._id, purpose: 'verify_email', tokenHash: 'secret-hash', expiresAt: deps.clock.now() });
    await NotificationModel.create({ user: customer.user._id, type: 'offer_received', params: {}, target: { kind: 'none' }, readAt: null });
    // Someone else's data stays out.
    await createRequest((await signInCustomer(deps)).user);

    const exported = await exportAccount(' NOA@example.com ', deps.clock.now());
    expect(exported).not.toBeNull();
    const json = JSON.parse(JSON.stringify(exported));
    expect(json).toMatchObject({
      exportedAt: '2026-10-01T09:00:00.000Z',
      account: { _id: customer.user._id.toHexString(), email: 'noa@example.com', role: 'customer', hasPassword: true, linkedToGoogle: true },
      professionalProfile: null,
      requests: [{ _id: done._id.toHexString(), description: done.description, location: expect.objectContaining({ addressLine: 'Dizengoff St 120' }) }],
      offers: [{ _id: offer._id.toHexString(), price: 350 }],
      jobs: [{ _id: job._id.toHexString(), status: 'completed' }],
      reviews: [{ rating: 5, comment: 'Great' }],
      conversations: [{ _id: chat }],
      messages: [{ text: 'Thanks!' }, { text: 'Anytime' }],
      notifications: [{ type: 'new_message', params: { messagePreview: 'Anytime' } }, { type: 'offer_received' }],
      sessions: [expect.objectContaining({ pushToken: expect.any(String) })],
      emailLinks: [{ purpose: 'verify_email' }],
      images: [avatar.url, requestPhoto.url],
    });
    const text = JSON.stringify(exported);
    for (const secret of ['argon-hash', 'google-noa', 'secret-hash', 'tokenHash', 'passwordHash', 'googleSub', 'writeSeq']) expect(text).not.toContain(secret);

    // A professional's: their profile, their offers and the reviews they received.
    const proExport = await exportAccount(pro.user._id.toHexString(), deps.clock.now());
    expect(proExport).toMatchObject({ professionalProfile: { displayName: pro.professional.displayName }, requests: [], offers: [{ _id: offer._id }], reviews: [{ rating: 5 }] });
    // Deleted or unknown: nothing.
    await deleteAccountOf(deps, 'noa@example.com', { via: 'email', sendEmail: false });
    expect(await exportAccount('noa@example.com', deps.clock.now())).toBeNull();
  });

  it('changes the sign-in email: lower-cased, unverified with a new link, old links void, sessions kept', async () => {
    const pro = await signInProfessional(deps, {
      user: { email: 'avi@example.com', emailVerifiedAt: deps.clock.now(), passwordHash: await hashPassword(STRONG_PASSWORD), googleSub: 'google-avi' },
      professional: { contact: { phone: '052-765-4321', email: 'avi@example.com', website: null } },
    });
    await createPushSession(pro.user);
    await EmailTokenModel.create({ user: pro.user._id, purpose: 'reset_password', tokenHash: 'old-link', expiresAt: new Date('2100-01-01') });

    const result = await changeSignInEmail(deps, 'Avi@Example.com', ' Avi.Cohen@Example.org ');
    expect(result).toEqual({ status: 'changed', userId: pro.user._id, role: 'professional', contactEmailChanged: true, linkedToGoogle: true });
    const user = await UserModel.findById(pro.user._id).lean();
    expect(user).toMatchObject({ email: 'avi.cohen@example.org', googleSub: 'google-avi' });
    expect(user).not.toHaveProperty('emailVerifiedAt');
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.contact.email).toBe('avi.cohen@example.org');
    expect(await EmailTokenModel.find({ user: pro.user._id }).lean()).toEqual([expect.objectContaining({ purpose: 'verify_email' })]);
    expect(deps.mailer.lastTo('avi.cohen@example.org')?.text).toContain('/v1/auth/verify-email?token=');
    expect(deps.mailer.lastTo('avi@example.com')).toBeUndefined();
    expect(await SessionModel.countDocuments({ user: pro.user._id })).toBe(1);
    // The new address signs in; the old one no longer does.
    await request(app).post('/v1/auth/login').send({ email: 'avi.cohen@example.org', password: STRONG_PASSWORD }).expect(200);
    await request(app).post('/v1/auth/login').send({ email: 'avi@example.com', password: STRONG_PASSWORD }).expect(401);
    const me = await request(app).get('/v1/me').set(pro.headers).expect(200);
    expect(me.body).toMatchObject({ user: { email: 'avi.cohen@example.org' }, emailVerified: false });
  });

  it('keeps a contact email the professional changed, and refuses a taken, invalid or same address', async () => {
    const pro = await signInProfessional(deps, { user: { email: 'avi@example.com' } });
    await signInCustomer(deps, { email: 'noa@example.com' });
    expect(await changeSignInEmail(deps, 'avi@example.com', 'NOA@example.com')).toEqual({ status: 'email_taken' });
    expect(await changeSignInEmail(deps, 'avi@example.com', 'not-an-email')).toEqual({ status: 'invalid_email' });
    expect(await changeSignInEmail(deps, pro.user._id.toHexString(), 'Avi@example.com')).toEqual({ status: 'unchanged' });
    expect(await changeSignInEmail(deps, 'nobody@example.com', 'new@example.com')).toEqual({ status: 'no_account' });
    expect(deps.mailer.sent).toEqual([]);

    expect(await changeSignInEmail(deps, 'avi@example.com', 'avi@example.org')).toMatchObject({ status: 'changed', contactEmailChanged: false, linkedToGoogle: false });
    expect((await ProfessionalModel.findById(pro.user._id).lean())?.contact.email).toBe(pro.professional.contact.email);
  });

  it('lists the address, language and first name of every account that is not deleted', async () => {
    await signInCustomer(deps, { email: 'noa@example.com', firstName: 'Noa', language: 'he' });
    await signInProfessional(deps, { user: { email: 'avi@example.com', firstName: 'Avi', language: 'en' } });
    const gone = await signInCustomer(deps, { email: 'dana@example.com' });
    await signInCustomer(deps, { email: '"o,brien"@example.com', firstName: 'Liam' });
    await deleteAccountOf(deps, gone.user._id.toHexString(), { via: 'email', sendEmail: false });

    expect(await activeAccountEmailsCsv()).toEqual({
      count: 3,
      csv: ['email,language,firstName,role', 'noa@example.com,he,Noa,customer', 'avi@example.com,en,Avi,professional', '"""o,brien""@example.com",en,Liam,customer', ''].join('\n'),
    });
  });
});
