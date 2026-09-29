import { describe, expect, it } from 'vitest';

import { signAccessToken, verifyAccessToken } from '../access-token.js';
import { FakeClock } from '../clock.js';

const config = { accessSecret: 's'.repeat(40), issuer: 'professionals-api', audience: 'professionals-app' };
const subject = { userId: '64b7f0c2a1b2c3d4e5f60718', role: 'customer' as const, sessionId: 'sess-1' };

describe('access tokens', () => {
  it('round-trips the claims and expires after 30 minutes', () => {
    const clock = new FakeClock('2026-10-01T10:00:00.000Z');
    const { token, expiresAt } = signAccessToken(config, subject, clock);
    expect(expiresAt.toISOString()).toBe('2026-10-01T10:30:00.000Z');
    expect(verifyAccessToken(config, token, clock)).toEqual({ ...subject, expiresAt: expiresAt.getTime() / 1000 });

    clock.advanceMinutes(30);
    expect(verifyAccessToken(config, token, clock)).toBeNull();
  });

  it('rejects tokens signed with another secret, issuer or audience', () => {
    const clock = new FakeClock();
    const { token } = signAccessToken(config, subject, clock);
    expect(verifyAccessToken({ ...config, accessSecret: 'o'.repeat(40) }, token, clock)).toBeNull();
    expect(verifyAccessToken({ ...config, issuer: 'other' }, token, clock)).toBeNull();
    expect(verifyAccessToken({ ...config, audience: 'other' }, token, clock)).toBeNull();
    expect(verifyAccessToken(config, 'not-a-jwt', clock)).toBeNull();
  });
});
