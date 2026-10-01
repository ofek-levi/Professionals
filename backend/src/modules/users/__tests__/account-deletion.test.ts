import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { signInCustomer, signInProfessional } from '../../../../test/auth.js';
import { createJob, createOffer, createRequest } from '../../../../test/factories.js';
import { SessionModel } from '../../auth/session.model.js';
import { hashPassword } from '../../auth/passwords.js';
import { STRONG_PASSWORD, customerPayload, professionalPayload, registerAccount } from '../../auth/__tests__/auth-test-helpers.js';
import { deleteAccountOf } from '../account-deletion.service.js';
import { UserModel } from '../user.model.js';

const HOUR = 60 * 60_000;

describe('account deletion: impact and confirmation', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  let passwordHash = '';
  beforeAll(async () => {
    passwordHash = await hashPassword(STRONG_PASSWORD);
  });
  beforeEach(async () => {
    await clearDatabase();
    deps.mailer.sent.length = 0;
  });
  const inHours = (hours: number) => new Date(deps.clock.now().getTime() + hours * HOUR);

  it("lists a customer's requests, drafts, offers to decline and jobs, with the other party's name", async () => {
    const customer = await signInCustomer(deps, { passwordHash });
    const [pro, other] = [await signInProfessional(deps, { professional: { displayName: 'Avi Fix' } }), await signInProfessional(deps)];
    await createRequest(customer.user, { status: 'draft', publishedAt: null });
    const open = await createRequest(customer.user, { status: 'offers_received', pendingOfferCount: 2 });
    await createOffer(open, pro.professional);
    await createOffer(open, other.professional);
    const scheduled = await createRequest(customer.user, { status: 'scheduled' });
    const scheduledJob = await createJob(scheduled, await createOffer(scheduled, pro.professional, { status: 'accepted', proposedStartAt: inHours(48) }));
    const started = await createRequest(customer.user, { status: 'in_progress' });
    const startedJob = await createJob(started, await createOffer(started, pro.professional, { status: 'accepted', proposedStartAt: inHours(1) }), {
      status: 'in_progress',
    });
    const done = await createRequest(customer.user, { status: 'completed' });
    await createJob(done, await createOffer(done, pro.professional, { status: 'accepted' }), { status: 'completed' });

    const res = await request(app).get('/v1/me/deletion-impact').set(customer.headers).expect(200);
    expect(res.body).toEqual({
      role: 'customer',
      reauthentication: { password: true, google: false },
      requestsToCancel: {
        count: 3,
        items: expect.arrayContaining([
          {
            id: open._id.toHexString(),
            requestId: open._id.toHexString(),
            categoryId: 'plumbing',
            status: 'offers_received',
            date: '2026-10-01T09:00:00.000Z',
            counterpartName: null,
          },
          expect.objectContaining({ id: started._id.toHexString(), status: 'in_progress', counterpartName: 'Avi Fix' }),
        ]),
      },
      offersToDecline: 2,
      draftsToDelete: 1,
      jobsToCancel: {
        count: 2,
        // Soonest first.
        items: [
          expect.objectContaining({ id: startedJob._id.toHexString(), status: 'in_progress', date: inHours(1).toISOString(), counterpartName: 'Avi Fix' }),
          expect.objectContaining({ id: scheduledJob._id.toHexString(), requestId: scheduled._id.toHexString(), status: 'scheduled' }),
        ],
      },
    });
  });

  it("lists a professional's pending offers (overdue ones too) and active jobs", async () => {
    const pro = await signInProfessional(deps, { user: { googleSub: 'google-avi' } });
    const customer = await signInCustomer(deps, { firstName: 'Noa', lastName: 'Levi' });
    const first = await createRequest(customer.user, { categoryId: 'handyman' });
    const offer = await createOffer(first, pro.professional, { proposedStartAt: inHours(30) });
    const overdue = await createOffer(await createRequest(customer.user), pro.professional, { expiresAt: inHours(-1) });
    await createOffer(await createRequest(customer.user), pro.professional, { status: 'withdrawn' });
    const hired = await createRequest(customer.user, { status: 'professional_selected' });
    const job = await createJob(hired, await createOffer(hired, pro.professional, { status: 'accepted' }), { status: 'awaiting_confirmation' });

    const res = await request(app).get('/v1/me/deletion-impact').set(pro.headers).expect(200);
    expect(res.body).toEqual({
      role: 'professional',
      reauthentication: { password: false, google: true },
      offersToWithdraw: {
        count: 2,
        items: expect.arrayContaining([
          {
            id: offer._id.toHexString(),
            requestId: first._id.toHexString(),
            categoryId: 'handyman',
            status: 'pending',
            date: inHours(30).toISOString(),
            counterpartName: 'Noa L.',
          },
          expect.objectContaining({ id: overdue._id.toHexString() }),
        ]),
      },
      jobsToCancel: { count: 1, items: [expect.objectContaining({ id: job._id.toHexString(), status: 'awaiting_confirmation', counterpartName: 'Noa L.' })] },
    });
  });

  it('asks a password account for its password and refuses a wrong one with 400, never 401', async () => {
    const customer = await signInCustomer(deps, { passwordHash });
    const missing = await request(app).post('/v1/me/deletion').set(customer.headers).send({}).expect(400);
    expect(missing.body.fieldErrors).toEqual({ password: ['validation:auth.passwordRequired'] });
    // A Google token is no proof for an account that is not linked to Google.
    const google = deps.google.issue({ email: customer.user.email });
    await request(app).post('/v1/me/deletion').set(customer.headers).send({ googleIdToken: google }).expect(400);
    const wrong = await request(app).post('/v1/me/deletion').set(customer.headers).send({ password: 'Not-The-Password-1' }).expect(400);
    expect(wrong.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), fieldErrors: { password: ['validation:auth.passwordIncorrect'] } });
    expect((await UserModel.findById(customer.user._id).lean())?.deletedAt).toBeUndefined();

    await request(app).post('/v1/me/deletion').set(customer.headers).send({ password: STRONG_PASSWORD }).expect(200, { success: true });
    expect((await UserModel.findById(customer.user._id).lean())?.deletedAt).toEqual(deps.clock.now());
  });

  it('confirms a Google-only account with a token of its own Google account', async () => {
    const pro = await signInProfessional(deps, { user: { email: 'avi@example.com', googleSub: 'google-avi' } });
    const password = await request(app).post('/v1/me/deletion').set(pro.headers).send({ password: STRONG_PASSWORD }).expect(400);
    expect(password.body.fieldErrors).toEqual({ googleIdToken: ['validation:required'] });
    const otherAccount = deps.google.issue({ email: 'avi@example.com', sub: 'google-someone-else' });
    const mismatch = await request(app).post('/v1/me/deletion').set(pro.headers).send({ googleIdToken: otherAccount }).expect(400);
    expect(mismatch.body.fieldErrors).toEqual({ googleIdToken: ['validation:invalid'] });
    await request(app).post('/v1/me/deletion').set(pro.headers).send({ googleIdToken: 'expired-or-forged' }).expect(400);

    const own = deps.google.issue({ email: 'avi@example.com', sub: 'google-avi' });
    await request(app).post('/v1/me/deletion').set(pro.headers).send({ googleIdToken: own }).expect(200);
    // A second submit (another device, a double tap) finds the account gone.
    await request(app).post('/v1/me/deletion').set(pro.headers).send({ googleIdToken: own }).expect(401);
    await request(app).get('/v1/me/deletion-impact').set(pro.headers).expect(401);
  });

  it('accepts the linked Google account instead of the password', async () => {
    const customer = await signInCustomer(deps, { passwordHash, googleSub: 'google-noa' });
    const token = deps.google.issue({ email: customer.user.email, sub: 'google-noa' });
    await request(app).post('/v1/me/deletion').set(customer.headers).send({ googleIdToken: token }).expect(200);
  });

  it('signs out everywhere: refresh, /me and sign-in fail; the email and the Google account can sign up again', async () => {
    const google = deps.google.issue({ email: 'dana@example.com', sub: 'google-dana' });
    const googleSession = await registerAccount(app, professionalPayload({ email: 'dana@example.com', password: null, googleIdToken: google }));
    const email = 'noa.deleted@example.com';
    const session = await registerAccount(app, customerPayload({ email }));
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    await deps.background.drain();

    await request(app).post('/v1/me/deletion').set(headers).send({ password: STRONG_PASSWORD }).expect(200);
    expect(await SessionModel.countDocuments({ user: session.user.id })).toBe(0);
    await request(app).get('/v1/me').set(headers).expect(401);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    const login = await request(app).post('/v1/auth/login').send({ email, password: STRONG_PASSWORD }).expect(401);
    expect(login.body.code).toBe('INVALID_CREDENTIALS');
    await registerAccount(app, customerPayload({ email }));

    const googleHeaders = { Authorization: `Bearer ${googleSession.accessToken}` };
    await request(app).post('/v1/me/deletion').set(googleHeaders).send({ googleIdToken: google }).expect(200);
    const again = await request(app).post('/v1/auth/google').send({ idToken: google }).expect(200);
    expect(again.body.status).toBe('registration_required');
    await registerAccount(app, customerPayload({ email: 'dana@example.com', password: null, googleIdToken: google }));
  });

  it('emails a confirmation to the address the account had, in its language', async () => {
    const customer = await signInCustomer(deps, { passwordHash, email: 'noa@example.com', firstName: 'Noa', language: 'he' });
    await request(app).post('/v1/me/deletion').set(customer.headers).send({ password: STRONG_PASSWORD }).expect(200);
    await deps.background.drain();
    const mail = deps.mailer.lastTo('noa@example.com');
    expect(mail).toMatchObject({ subject: 'החשבון שלכם ב-Professionals נמחק' });
    expect(mail?.html).toContain('<span dir="ltr">noa@example.com</span>');
    expect(mail?.html).toContain('dir="rtl"');
    expect(mail?.text).toContain('היי Noa,');
    expect(mail?.text).toContain('לבקשתכם באפליקציה, החשבון');
    // Nothing was in progress: no sentence about cancellations.
    expect(mail?.text).not.toContain('בוטלו');
    expect(mail?.html).not.toContain('בוטלו');
    // Development has no operator address yet: a visible placeholder says where to set it.
    expect(mail?.text).toContain('backend/src/config/legal.ts');

    const pro = await signInProfessional(deps, { user: { passwordHash, email: 'avi@example.com', language: 'en' } });
    await request(app).post('/v1/me/deletion').set(pro.headers).send({ password: STRONG_PASSWORD }).expect(200);
    await deps.background.drain();
    expect(deps.mailer.lastTo('avi@example.com')).toMatchObject({ subject: 'Your Professionals account was deleted' });
    expect(deps.mailer.lastTo('avi@example.com')?.text).toContain('Server logs are overwritten within 30 days and backups within 30 days.');
  });
});

describe('account deletion: what the confirmation says was closed', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  let passwordHash = '';
  beforeAll(async () => {
    passwordHash = await hashPassword(STRONG_PASSWORD);
  });
  beforeEach(async () => {
    await clearDatabase();
    deps.mailer.sent.length = 0;
  });
  const deleteAndRead = async (caller: { headers: Record<string, string> }, email: string) => {
    await request(app).post('/v1/me/deletion').set(caller.headers).send({ password: STRONG_PASSWORD }).expect(200);
    await deps.background.drain();
    return deps.mailer.lastTo(email)?.text ?? '';
  };

  it('customer: names the requests, the declined offers and the jobs that were cancelled, and who was told', async () => {
    const customer = await signInCustomer(deps, { passwordHash, email: 'noa@example.com' });
    const pro = await signInProfessional(deps);
    const open = await createRequest(customer.user, { status: 'offers_received', pendingOfferCount: 1 });
    await createOffer(open, pro.professional);
    const scheduled = await createRequest(customer.user, { status: 'scheduled' });
    await createJob(scheduled, await createOffer(scheduled, pro.professional, { status: 'accepted' }));
    expect(await deleteAndRead(customer, 'noa@example.com')).toContain(
      'Your active requests were cancelled, the pending offers on them were declined and your active jobs were cancelled; the professionals involved were notified, unless they turned those notifications off.',
    );

    // Only a request nobody answered: cancelled (and deleted), nobody to tell.
    const alone = await signInCustomer(deps, { passwordHash, email: 'dana@example.com', language: 'he' });
    await createRequest(alone.user);
    const text = await deleteAndRead(alone, 'dana@example.com');
    expect(text).toContain('\nהבקשות הפעילות שלכם בוטלו.\n');
    expect(text).not.toContain('קיבלו על כך הודעה');
  });

  it('professional: names the withdrawn offers and the cancelled jobs', async () => {
    const customer = await signInCustomer(deps);
    const pro = await signInProfessional(deps, { user: { passwordHash, email: 'avi@example.com', language: 'he' } });
    await createOffer(await createRequest(customer.user, { status: 'offers_received', pendingOfferCount: 1 }), pro.professional);
    const hired = await createRequest(customer.user, { status: 'scheduled' });
    await createJob(hired, await createOffer(hired, pro.professional, { status: 'accepted' }));
    expect(await deleteAndRead(pro, 'avi@example.com')).toContain(
      'ההצעות הממתינות שלכם נמשכו והעבודות הפעילות שלכם בוטלו; הלקוחות המעורבים קיבלו על כך הודעה, אלא אם כיבו את ההתראות האלה.',
    );

    const other = await signInProfessional(deps, { user: { passwordHash, email: 'dan@example.com', language: 'en' } });
    await createOffer(await createRequest(customer.user, { status: 'offers_received', pendingOfferCount: 1 }), other.professional);
    const text = await deleteAndRead(other, 'dan@example.com');
    expect(text).toContain('\nYour pending offers were withdrawn; the customers involved were notified, unless they turned those notifications off.\n');
    expect(text).not.toContain('jobs were cancelled');
  });
});

describe('account deletion by the operator', () => {
  const { deps } = createTestApp();
  beforeEach(async () => {
    await clearDatabase();
    deps.mailer.sent.length = 0;
  });

  it('deletes by sign-in email or by id, like the app, and says when there is no such account', async () => {
    const customer = await signInCustomer(deps, { email: 'noa@example.com' });
    const pro = await signInProfessional(deps);
    expect(await deleteAccountOf(deps, ' Noa@Example.com ', { via: 'email' })).toMatchObject({ _id: customer.user._id, role: 'customer' });
    expect(await deleteAccountOf(deps, pro.user._id.toHexString(), { via: 'email' })).toMatchObject({ role: 'professional' });
    await deps.background.drain();
    expect(deps.mailer.lastTo('noa@example.com')?.subject).toBe('Your Professionals account was deleted');
    expect((await UserModel.findById(customer.user._id).lean())?.deletedAt).toBeDefined();
    // Once deleted (or never there), nothing matches.
    expect(await deleteAccountOf(deps, 'noa@example.com', { via: 'email' })).toBeNull();
    expect(await deleteAccountOf(deps, pro.user._id.toHexString(), { via: 'email' })).toBeNull();
  });

  it('says in the confirmation who asked: an emailed request, or nobody (a closure)', async () => {
    await signInCustomer(deps, { email: 'noa@example.com' });
    await signInProfessional(deps, { user: { email: 'avi@example.com', language: 'he' } });
    await deleteAccountOf(deps, 'noa@example.com', { via: 'email' });
    await deleteAccountOf(deps, 'avi@example.com', { via: 'operator' });
    await deps.background.drain();
    const emailed = deps.mailer.lastTo('noa@example.com');
    expect(emailed?.text).toContain('As you asked by email, the Professionals account \u2068noa@example.com\u2069 was deleted.');
    expect(emailed?.html).toContain('As you asked by email, the Professionals account <span dir="ltr">noa@example.com</span> was deleted.');
    const closed = deps.mailer.lastTo('avi@example.com');
    expect(closed?.text).toContain('\nהחשבון \u2068avi@example.com\u2069 ב-Professionals נמחק. אי אפשר לבטל את המחיקה.\n');
    expect(closed?.text).not.toContain('לבקשתכם');
  });

  it('deletes again without any email after a backup restore (--no-email)', async () => {
    const customer = await signInCustomer(deps, { email: 'noa@example.com' });
    expect(await deleteAccountOf(deps, customer.user._id.toHexString(), { via: 'email', sendEmail: false })).toMatchObject({ role: 'customer' });
    await deps.background.drain();
    expect(deps.mailer.sent).toEqual([]);
    expect((await UserModel.findById(customer.user._id).lean())?.deletedAt).toBeDefined();
  });
});

describe('account deletion: rate limits', () => {
  const { app, deps } = createTestApp({ env: { RATE_LIMIT_ENABLED: 'true', TRUST_PROXY: 'true' } });
  beforeEach(clearDatabase);

  it('counts wrong passwords towards the sign-in throttle and allows a few attempts per hour', async () => {
    const customer = await signInCustomer(deps, { passwordHash: await hashPassword(STRONG_PASSWORD) });
    const ip = '198.51.100.20';
    const attempt = () => request(app).post('/v1/me/deletion').set(customer.headers).set('X-Forwarded-For', ip).send({ password: 'Wrong-Password-1' });
    for (let i = 0; i < 5; i += 1) await attempt().expect(400);
    // The route's own hourly budget.
    await attempt().expect(429);
    // The 5 failures count for sign-ins from the same network: 5 more reach the per-account limit.
    const login = () => request(app).post('/v1/auth/login').set('X-Forwarded-For', ip).send({ email: customer.user.email, password: 'Wrong-Password-1' });
    for (let i = 0; i < 5; i += 1) await login().expect(401);
    await login().expect(429);
  });
});
