import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { bearer } from '../../../../test/auth.js';
import { createCustomer } from '../../../../test/factories.js';
import { UserModel } from '../../users/user.model.js';
import { SessionModel } from '../session.model.js';
import { customerPayload, linkSentTo, loginAccount, pathOf, registerAccount } from './auth-test-helpers.js';

const NEW_PASSWORD = 'Brand-New-Pass-7';

describe('password reset', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(clearDatabase);

  async function requestLink(email: string, typed = email) {
    await request(app).post('/v1/auth/password-reset').send({ email: typed }).expect(200, { success: true });
    return linkSentTo(deps, email);
  }

  const submitForm = (fields: Record<string, string>) =>
    request(app).post('/v1/auth/reset-password').type('form').send(fields);

  it('emails a reset link only when the account exists, answering the same either way', async () => {
    await createCustomer({ email: 'noa@example.com', language: 'he' });
    const { mail, url } = await requestLink('noa@example.com', ' NOA@example.com');
    expect(mail.subject).toBe('איפוס הסיסמה שלכם');
    expect(mail.html).toContain('lang="he" dir="rtl"');
    expect(url.pathname).toBe('/v1/auth/reset-password');

    await request(app).post('/v1/auth/password-reset').send({ email: 'nobody@example.com' }).expect(200, { success: true });
    await deps.background.drain();
    expect(deps.mailer.lastTo('nobody@example.com')).toBeUndefined();

    const invalid = await request(app).post('/v1/auth/password-reset').send({ email: 'nope' }).expect(400);
    expect(invalid.body.fieldErrors).toEqual({ email: ['validation:auth.emailInvalid'] });
  });

  it('shows the form without using the link up', async () => {
    await createCustomer({ email: 'noa@example.com', language: 'en' });
    const { url, token } = await requestLink('noa@example.com');

    for (let i = 0; i < 2; i += 1) {
      const page = await request(app).get(pathOf(url)).expect(200);
      expect(page.headers['content-type']).toMatch(/text\/html/);
      expect(page.headers['cache-control']).toBe('no-store');
      expect(page.headers['content-security-policy']).toContain("form-action 'self'");
      expect(page.text).toContain('<html lang="en" dir="ltr">');
      expect(page.text).toContain(`name="token" value="${token}"`);
      expect(page.text).toContain('action="reset-password"');
    }
  });

  it('changes the password from the form, verifies the email and signs out everywhere', async () => {
    const session = await registerAccount(app, customerPayload({ email: 'noa@example.com', preferredLanguage: 'he' }));
    const { token } = await requestLink('noa@example.com');

    const mismatch = await submitForm({ token, password: NEW_PASSWORD, confirmPassword: 'Other-Pass-7' }).expect(400);
    expect(mismatch.text).toContain('הסיסמאות אינן תואמות');
    expect(mismatch.text).toContain('dir="rtl"');
    const weak = await submitForm({ token, password: 'short1', confirmPassword: 'short1' }).expect(400);
    expect(weak.text).toContain('הסיסמה צריכה להכיל לפחות 8 תווים');

    const done = await submitForm({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }).expect(200);
    expect(done.text).toContain('הסיסמה שונתה');

    await request(app).post('/v1/auth/login').send({ email: 'noa@example.com', password: 'Sunny-Garden-42' }).expect(401);
    await loginAccount(app, 'noa@example.com', NEW_PASSWORD);
    await request(app).post('/v1/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    await request(app).get('/v1/me').set(bearer(session.accessToken)).expect(401);
    expect(await UserModel.findById(session.user.id, { emailVerifiedAt: 1 }).lean()).toMatchObject({ emailVerifiedAt: expect.any(Date) });

    // Single use.
    const reused = await submitForm({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }).expect(400);
    expect(reused.text).toContain('This link is no longer valid');
  });

  it('accepts JSON from API clients', async () => {
    await createCustomer({ email: 'noa@example.com' });
    const { token } = await requestLink('noa@example.com');

    const weak = await request(app).post('/v1/auth/reset-password').send({ token, password: 'password1' }).expect(400);
    expect(weak.body.fieldErrors).toEqual({ password: ['validation:auth.passwordTooCommon'] });
    await request(app).post('/v1/auth/reset-password').send({ token, password: NEW_PASSWORD }).expect(200, { success: true });
    const reused = await request(app).post('/v1/auth/reset-password').send({ token, password: NEW_PASSWORD }).expect(400);
    expect(reused.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String), fieldErrors: { token: ['validation:invalid'] } });
    await loginAccount(app, 'noa@example.com', NEW_PASSWORD);
  });

  it('refuses a breached password on the form and as JSON, keeping the link usable', async () => {
    deps.passwordBreach.breached.add('Breached-Pass-77');
    await createCustomer({ email: 'noa@example.com', language: 'en' });
    const { token } = await requestLink('noa@example.com');

    const form = await submitForm({ token, password: 'Breached-Pass-77', confirmPassword: 'Breached-Pass-77' }).expect(400);
    expect(form.text).toContain('This password is too easy to guess');
    expect(form.text).toContain('<form');
    const json = await request(app).post('/v1/auth/reset-password').send({ token, password: 'Breached-Pass-77' }).expect(400);
    expect(json.body.fieldErrors).toEqual({ password: ['validation:auth.passwordTooCommon'] });
    await submitForm({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }).expect(200);
  });

  it('lets a Google-only account set a password', async () => {
    await createCustomer({ email: 'google@example.com', googleSub: 'google-1' });
    const { token } = await requestLink('google@example.com');
    await submitForm({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }).expect(200);
    await loginAccount(app, 'google@example.com', NEW_PASSWORD);
  });

  it('expires links after an hour; a newer link does not invalidate the earlier ones', async () => {
    await createCustomer({ email: 'noa@example.com' });
    const first = await requestLink('noa@example.com');
    const second = await requestLink('noa@example.com');
    expect(second.token).not.toBe(first.token);
    // Someone else asking for a reset of this address must not kill the link the owner opens.
    await request(app).get(pathOf(first.url)).expect(200);
    await request(app).get(pathOf(second.url)).expect(200);

    deps.clock.advanceMinutes(61);
    const expired = await request(app).get(pathOf(second.url)).set('Accept-Language', 'he-IL,he;q=0.9').expect(400);
    expect(expired.text).toContain('הקישור כבר לא בתוקף');
    await request(app).get('/v1/auth/reset-password').expect(400);
    expect(await SessionModel.countDocuments()).toBe(0);
  });
});
