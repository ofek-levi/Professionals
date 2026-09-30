import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { UserModel } from '../../users/user.model.js';
import { customerPayload, linkSentTo, pathOf, registerAccount } from './auth-test-helpers.js';

describe('verify-email link (GET confirmation page, POST confirms)', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(clearDatabase);

  const confirm = (token: string) => request(app).post('/v1/auth/verify-email').type('form').send({ token });

  it('opening the link (a mail scanner prefetch) verifies nothing; the confirm button does, once', async () => {
    const session = await registerAccount(app, customerPayload({ email: 'noa@example.com', preferredLanguage: 'he' }));
    const { url, mail, token } = await linkSentTo(deps, 'noa@example.com');
    expect(mail.text).toContain('Noa');

    deps.clock.advanceMinutes(10);
    for (let prefetch = 0; prefetch < 3; prefetch += 1) {
      const page = await request(app).get(pathOf(url)).expect(200);
      expect(page.text).toContain('<html lang="he" dir="rtl">');
      expect(page.text).toContain('<form method="post" action="verify-email">');
      expect(page.text).toContain('noa@example.com');
      expect(page.headers['cache-control']).toBe('no-store');
    }
    const unverified = await UserModel.findById(session.user.id, { emailVerifiedAt: 1 }).lean();
    expect(unverified?.emailVerifiedAt ?? null).toBeNull();

    const done = await confirm(token).expect(200);
    expect(done.text).toContain('כתובת האימייל אושרה');
    const user = await UserModel.findById(session.user.id, { emailVerifiedAt: 1 }).lean();
    expect(user?.emailVerifiedAt?.toISOString()).toBe('2026-10-01T09:10:00.000Z');

    const again = await confirm(token).set('Accept-Language', 'en').expect(400);
    expect(again.text).toContain('This link is no longer valid');
    await request(app).get(pathOf(url)).expect(400);
  });

  it('pre-account hijacking: a scanner-opened link does not make Google trust the squatter’s password', async () => {
    await registerAccount(app, customerPayload({ email: 'owner@example.com' }));
    const { url } = await linkSentTo(deps, 'owner@example.com');
    await request(app).get(pathOf(url)).expect(200);

    await request(app).post('/v1/auth/google').send({ idToken: deps.google.issue({ email: 'owner@example.com', sub: 'google-owner' }) }).expect(200);
    const user = await UserModel.findOne({ email: 'owner@example.com' }).lean();
    expect(user?.passwordHash).toBeUndefined();
  });

  it('sends a new link on request (signed in) when the first one expired, and nothing once verified', async () => {
    const session = await registerAccount(app, customerPayload({ email: 'later@example.com' }));
    const first = await linkSentTo(deps, 'later@example.com');
    deps.clock.advance(49 * 60 * 60_000); // the sign-up link is gone
    await request(app).post('/v1/auth/verify-email/resend').expect(401);

    // Signed in again (the sign-up access token expired meanwhile).
    const refreshed = await request(app).post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);
    const headers = { Authorization: `Bearer ${(refreshed.body as { accessToken: string }).accessToken}` };
    await request(app).post('/v1/auth/verify-email/resend').set(headers).expect(200, { success: true });
    const second = await linkSentTo(deps, 'later@example.com');
    expect(second.token).not.toBe(first.token);
    await confirm(second.token).expect(200);
    expect((await request(app).get('/v1/me').set(headers).expect(200)).body.emailVerified).toBe(true);

    const sent = deps.mailer.sent.length;
    await request(app).post('/v1/auth/verify-email/resend').set(headers).expect(200, { success: true });
    await deps.background.drain();
    expect(deps.mailer.sent).toHaveLength(sent);
  });

  it('rejects expired and missing links', async () => {
    await registerAccount(app, customerPayload({ email: 'late@example.com' }));
    const { url } = await linkSentTo(deps, 'late@example.com');
    deps.clock.advance(49 * 60 * 60_000);
    const expired = await request(app).get(pathOf(url)).set('Accept-Language', 'he').expect(400);
    expect(expired.text).toContain('הקישור כבר לא בתוקף');
    expect(await UserModel.countDocuments({ emailVerifiedAt: { $exists: true } })).toBe(0);

    const missing = await request(app).get('/v1/auth/verify-email').expect(400);
    expect(missing.text).toContain('<html lang="en" dir="ltr">');
    await confirm('').expect(400);
  });

  it('escapes user data in the email', async () => {
    await registerAccount(app, customerPayload({ email: 'o.brien@example.com', firstName: "O'Brien" }));
    const { mail } = await linkSentTo(deps, 'o.brien@example.com');
    expect(mail.html).toContain('O&#39;Brien');
    expect(mail.html).not.toContain("O'Brien");
  });
});
