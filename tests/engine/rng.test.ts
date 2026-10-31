import { describe, expect, it } from 'vitest';
import { drawBelow, drawBetween, keyHash } from '../../src/engine/rng';

describe('counter-based randomness', () => {
  it('is a pure function of the seed and the key', () => {
    expect(keyHash(1, ['battle', 2])).toBe(keyHash(1, ['battle', 2]));
    expect(keyHash(1, ['battle', 2])).not.toBe(keyHash(2, ['battle', 2]));
    expect(keyHash(1, ['battle', 2])).not.toBe(keyHash(1, ['battle', 3]));
    expect(keyHash(1, ['ab'])).not.toBe(keyHash(1, ['a', 'b']));
  });

  it('is close to uniform', () => {
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 20_000; i++) buckets[drawBelow(42, ['uniformity', i], 10)]! += 1;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(1_800);
      expect(count).toBeLessThan(2_200);
    }
  });

  it('keeps ranged draws in range', () => {
    for (let i = 0; i < 2_000; i++) {
      const v = drawBetween(9, ['range', i], 800, 1200);
      expect(v).toBeGreaterThanOrEqual(800);
      expect(v).toBeLessThanOrEqual(1200);
    }
  });

  it('refuses non-integer key parts, which could differ between browsers', () => {
    expect(() => keyHash(1, [0.5])).toThrow();
  });
});
