import { createSubmissionKeys } from '../submission-key';

describe('createSubmissionKeys', () => {
  it('keeps the key for a retry of the same payload and renews it when the payload changes', () => {
    let n = 0;
    const keys = createSubmissionKeys(() => `key-${(n += 1)}`);
    const payload = { payload: { description: 'Leaking sink' }, photos: ['file:///photos/1.jpg'] };

    expect(keys.keyFor(payload)).toBe('key-1');
    // Timed out: the same form is posted again.
    expect(keys.keyFor({ ...payload })).toBe('key-1');
    // Edited in between (a field, or the photos): another request.
    expect(keys.keyFor({ ...payload, payload: { description: 'Leaking kitchen sink' } })).toBe('key-2');
    expect(keys.keyFor({ ...payload, payload: { description: 'Leaking kitchen sink' } })).toBe('key-2');
    expect(keys.keyFor({ ...payload, photos: [] })).toBe('key-3');
  });

  it('makes app-wide unique keys by default', () => {
    const [a, b] = [createSubmissionKeys(), createSubmissionKeys()];
    expect(a.keyFor({})).not.toBe(b.keyFor({}));
    expect(a.keyFor({})).toMatch(/^creq_/);
  });
});
