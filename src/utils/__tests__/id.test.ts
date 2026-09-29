import { compareIds, createClientMessageId, createId } from '../id';

describe('id utils', () => {
  it('creates unique prefixed ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => createId('req')));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(/^req_[0-9a-z]{17}$/);
  });

  it('sorts ids created later after earlier ones', () => {
    const earlier = createId('off', new Date('2026-01-01T00:00:00Z'));
    const later = createId('off', new Date('2026-06-01T00:00:00Z'));
    expect(earlier < later).toBe(true);
  });

  it('orders ids by code units, independent of the locale', () => {
    const earlier = createId('off', new Date('2026-01-01T00:00:00Z'));
    const later = createId('off', new Date('2026-06-01T00:00:00Z'));
    expect([later, earlier].sort(compareIds)).toEqual([earlier, later]);
    expect(compareIds('req_b', 'req_b')).toBe(0);
    // Code-unit order ('-' < '0' < 'Z' < '_' < 'a'), where a collator would ignore case or punctuation.
    expect(['a', '_', 'Z', '0', '-'].sort(compareIds)).toEqual(['-', '0', 'Z', '_', 'a']);
  });

  it('creates client message ids', () => {
    expect(createClientMessageId()).toMatch(/^cmsg_/);
    expect(createClientMessageId()).not.toBe(createClientMessageId());
  });
});
