/**
 * Deterministic hashing and pseudo-random numbers. Used where the same input must always produce
 * the same "random" output (approximate locations; the test double's fixtures).
 */

/** 32-bit FNV-1a hash of a string (unsigned). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface SeededRandom {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** Random element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** `true` with the given probability. */
  chance(probability: number): boolean;
  /** Shuffled copy of a list. */
  shuffle<T>(items: readonly T[]): T[];
}

/** Mulberry32 PRNG seeded from a string or number. */
export function createSeededRandom(seed: string | number): SeededRandom {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const random: SeededRandom = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    pick: (items) => {
      if (items.length === 0) throw new RangeError('Cannot pick from an empty list');
      return items[Math.floor(next() * items.length)];
    },
    chance: (probability) => next() < probability,
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
  return random;
}
