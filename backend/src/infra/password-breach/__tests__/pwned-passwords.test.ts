import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSilentLogger } from '../../../lib/logger.js';
import { PwnedPasswordsChecker } from '../password-breach.js';

const PASSWORD = 'Sunny-Garden-42';
const HASH = createHash('sha1').update(PASSWORD).digest('hex').toUpperCase();

function stubRange(body: string, status = 200) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(body, { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('PwnedPasswordsChecker (k-anonymity range API)', () => {
  const checker = new PwnedPasswordsChecker(createSilentLogger(), 'ProfessionalsAPI (test)');
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends only the 5-character hash prefix, with padding, and finds the suffix', async () => {
    const fetchMock = stubRange(`0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${HASH.slice(5)}:42\r\n`);
    expect(await checker.isBreached(PASSWORD)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${HASH.slice(0, 5)}`);
    expect(url).not.toContain(HASH.slice(5));
    expect(new Headers(init?.headers).get('Add-Padding')).toBe('true');
  });

  it('ignores padding entries (count 0) and other suffixes', async () => {
    stubRange(`${HASH.slice(5)}:0\r\n0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n`);
    expect(await checker.isBreached(PASSWORD)).toBe(false);
  });

  it('fails open when the service errors or is unreachable', async () => {
    stubRange('busy', 503);
    expect(await checker.isBreached(PASSWORD)).toBe(false);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('fetch failed'))));
    expect(await checker.isBreached(PASSWORD)).toBe(false);
  });
});
