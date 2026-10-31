// Counter-based randomness (§2.12, §3.3). Every draw is a pure function of the seed and a key,
// so no draw can shift another, whatever the player does in between.

export type KeyPart = string | number;

function mix32(x: number): number {
  let h = x >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hashString(text: string, salt = 0): number {
  let h = mix32(salt ^ 0x9e3779b9);
  for (let i = 0; i < text.length; i++) h = mix32(h ^ text.charCodeAt(i));
  return h;
}

export function keyHash(seed: number, key: readonly KeyPart[]): number {
  let h = mix32(seed);
  for (const part of key) {
    if (typeof part === 'number' && !Number.isInteger(part)) throw new Error(`random key parts must be integers, got ${part}`);
    h = mix32(h ^ hashString(String(part), h));
  }
  return h;
}

/** Uniform integer in [0, n). */
export function drawBelow(seed: number, key: readonly KeyPart[], n: number): number {
  return keyHash(seed, key) % n;
}

/** Uniform integer in [lo, hi]. */
export function drawBetween(seed: number, key: readonly KeyPart[], lo: number, hi: number): number {
  return lo + drawBelow(seed, key, hi - lo + 1);
}

/** True with probability permille / 1000. */
export function chance(seed: number, key: readonly KeyPart[], permille: number): boolean {
  return drawBelow(seed, key, 1000) < permille;
}
