import { createSeededRandom, hashString } from '../seeded-random';

describe('seeded random', () => {
  it('is deterministic per seed', () => {
    const a = createSeededRandom('seed');
    const b = createSeededRandom('seed');
    const sequence = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(sequence);
    expect(createSeededRandom('other').next()).not.toBe(sequence[0]);
    expect(hashString('abc')).toBe(hashString('abc'));
  });

  it('produces values within bounds', () => {
    const random = createSeededRandom(42);
    for (let i = 0; i < 200; i += 1) {
      const value = random.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
    expect(random.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(() => random.pick([])).toThrow(RangeError);
  });
});
