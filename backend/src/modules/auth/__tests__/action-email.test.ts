import { describe, expect, it } from 'vitest';

import { RESET_PASSWORD_TEXTS, VERIFY_EMAIL_TEXTS } from '../emails/auth-email-texts.js';
import { renderActionEmail } from '../emails/render-action-email.js';

const LINK = 'https://api.example.com/v1/auth/reset-password?token=xRZXWgklp_WwdFqjb8H5xuGQ8FUGXdYMTOGmR15de8Y';
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/;

/** What a mail client that linkifies plain text (or a user's copy-paste of the line) takes as the URL. */
const linkified = (text: string) => /https?:\/\/\S+/.exec(text)?.[0];

describe('action emails (plain text part)', () => {
  it.each([
    ['en', RESET_PASSWORD_TEXTS.en],
    ['he', RESET_PASSWORD_TEXTS.he],
    ['en', VERIFY_EMAIL_TEXTS.en],
    ['he', VERIFY_EMAIL_TEXTS.he],
  ] as const)('%s: the link stands alone on its line, with no invisible bidi marks around it', (language, texts) => {
    const mail = renderActionEmail(texts, { to: 'noa@example.com', firstName: 'Noa', language, link: LINK });

    expect(mail.text.split('\n')).toContain(LINK);
    expect(linkified(mail.text)).toBe(LINK);
    const linkLine = mail.text.split('\n').find((line) => line.includes('token='));
    expect(linkLine).toBe(LINK);
    expect(linkLine).not.toMatch(BIDI_MARKS);
  });

  it('keeps the email address isolated inside the Hebrew sentence', () => {
    const mail = renderActionEmail(RESET_PASSWORD_TEXTS.he, { to: 'noa@example.com', firstName: 'Noa', language: 'he', link: LINK });
    expect(mail.text).toContain('⁨noa@example.com⁩');
  });
});
