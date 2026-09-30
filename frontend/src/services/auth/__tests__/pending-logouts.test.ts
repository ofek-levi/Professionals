/**
 * The queue of server sign-outs not confirmed yet: persisted, sent again until the server accepts
 * or finally refuses them, bounded in size and age, and still working when storage fails.
 */
import { ApiError } from '@/services/api/errors';

import { createPendingLogouts } from '../pending-logouts';

const NOW = Date.parse('2026-09-30T10:00:00.000Z');
const DAY = 24 * 60 * 60_000;

interface MemoryStorage {
  value: string | null;
  failing: boolean;
  read: jest.Mock<Promise<string | null>, []>;
  write: jest.Mock<Promise<void>, [string | null]>;
}

function memoryStorage(initial: string | null = null): MemoryStorage {
  const storage: MemoryStorage = {
    value: initial,
    failing: false,
    read: jest.fn(async () => {
      if (storage.failing) throw new Error('keychain locked');
      return storage.value;
    }),
    write: jest.fn(async (value: string | null) => {
      if (storage.failing) throw new Error('keychain locked');
      storage.value = value;
    }),
  };
  return storage;
}

const refused = (status: number) => new ApiError(status, { code: status === 401 ? 'UNAUTHORIZED' : 'VALIDATION_ERROR', message: 'no' });

describe('pending logouts', () => {
  it('persists a queued logout and forgets it once the server accepts it', async () => {
    const storage = memoryStorage();
    const logout = jest.fn(async () => ({ success: true }));
    const queue = createPendingLogouts({ logout, storage, now: () => NOW });

    await queue.add('refresh-1');
    expect(JSON.parse(storage.value ?? '[]')).toEqual([{ refreshToken: 'refresh-1', since: NOW }]);

    // A relaunch reads the persisted queue.
    const relaunched = createPendingLogouts({ logout, storage, now: () => NOW });
    await relaunched.flush();
    expect(logout).toHaveBeenCalledWith('refresh-1');
    expect(await relaunched.pending()).toEqual([]);
    expect(storage.value).toBeNull();
  });

  it('keeps a logout after a network error, a timeout, 429 or 5xx, and drops it when the session is already over', async () => {
    const storage = memoryStorage();
    const answers: Record<string, unknown> = {
      offline: new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' }),
      slow: new ApiError(0, { code: 'TIMEOUT', message: 'timeout' }),
      limited: new ApiError(429, { code: 'RATE_LIMITED', message: 'slow down' }),
      down: new ApiError(503, { code: 'SERVER_ERROR', message: 'down' }),
      expired: refused(401),
      malformed: refused(400),
    };
    const logout = jest.fn(async (token: string) => {
      throw answers[token];
    });
    const queue = createPendingLogouts({ logout, storage, now: () => NOW });
    for (const token of Object.keys(answers)) await queue.add(token);

    await queue.flush();
    expect(logout).toHaveBeenCalledTimes(6);
    expect(await queue.pending()).toEqual(['offline', 'slow', 'limited', 'down']);
  });

  it('shares one run between concurrent flushes and sends each token once per run', async () => {
    let release: () => void = () => undefined;
    const logout = jest.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const queue = createPendingLogouts({ logout, storage: memoryStorage(), now: () => NOW });
    await queue.add('refresh-1');
    await queue.add('refresh-1');

    const first = queue.flush();
    const second = queue.flush();
    expect(second).toBe(first);
    for (let i = 0; i < 50 && logout.mock.calls.length === 0; i += 1) await Promise.resolve();
    release();
    await first;
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest 10 and drops tokens older than a refresh token lives (90 days)', async () => {
    let now = NOW - 91 * DAY;
    const storage = memoryStorage();
    const queue = createPendingLogouts({ logout: jest.fn(), storage, now: () => now });
    await queue.add('ancient');
    now = NOW;
    for (let i = 1; i <= 11; i += 1) await queue.add(`refresh-${i}`);
    expect(await queue.pending()).toEqual(Array.from({ length: 10 }, (_, i) => `refresh-${i + 2}`));
  });

  it('discard forgets a token without sending it', async () => {
    const logout = jest.fn();
    const queue = createPendingLogouts({ logout, storage: memoryStorage(), now: () => NOW });
    await queue.add('refresh-1');
    await queue.discard('refresh-1');
    await queue.flush();
    expect(logout).not.toHaveBeenCalled();
  });

  it('still retries during this launch when storage fails, and never throws', async () => {
    const storage = memoryStorage();
    storage.failing = true;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const logout = jest.fn(async () => {
      throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'offline' });
    });
    const queue = createPendingLogouts({ logout, storage, now: () => NOW });
    await expect(queue.add('refresh-1')).resolves.toBeUndefined();
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(logout).toHaveBeenCalledWith('refresh-1');
    expect(await queue.pending()).toEqual(['refresh-1']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores a corrupt stored value', async () => {
    const queue = createPendingLogouts({ logout: jest.fn(), storage: memoryStorage('{oops'), now: () => NOW });
    expect(await queue.pending()).toEqual([]);
    const other = createPendingLogouts({ logout: jest.fn(), storage: memoryStorage('[{"refreshToken":1},{"refreshToken":"ok","since":1}]'), now: () => 2 });
    expect(await other.pending()).toEqual(['ok']);
  });
});
