import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearDatabase, createTestApp } from '../../../../test/app.js';
import { UserModel } from '../../users/user.model.js';
import { customerPayload, linkSentTo, pathOf, registerAccount } from './auth-test-helpers.js';

describe('GET /v1/auth/verify-email', () => {
  const { app, deps } = createTestApp({ now: '2026-10-01T09:00:00.000Z' });
  beforeEach(clearDatabase);

  it('verifies the address once and shows a page in the account’s language', async () => {
    const session = await registerAccount(app, customerPayload({ email: 'noa@example.com', preferredLanguage: 'he' }));
    const { url, mail } = await linkSentTo(deps, 'noa@example.com');
    expect(mail.text).toContain('Noa');

    deps.clock.advanceMinutes(10);
    const page = await request(app).get(pathOf(url)).expect(200);
    expect(page.text).toContain('<html lang="he" dir="rtl">');
    expect(page.text).toContain('כתובת האימייל אושרה');
    expect(page.headers['cache-control']).toBe('no-store');
    const user = await UserModel.findById(session.user.id, { emailVerifiedAt: 1 }).lean();
    expect(user?.emailVerifiedAt?.toISOString()).toBe('2026-10-01T09:10:00.000Z');

    const again = await request(app).get(pathOf(url)).expect(400);
    expect(again.text).toContain('This link is no longer valid');
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
  });

  it('escapes user data in the email', async () => {
    await registerAccount(app, customerPayload({ email: 'o.brien@example.com', firstName: "O'Brien" }));
    const { mail } = await linkSentTo(deps, 'o.brien@example.com');
    expect(mail.html).toContain('O&#39;Brien');
    expect(mail.html).not.toContain("O'Brien");
  });
});
