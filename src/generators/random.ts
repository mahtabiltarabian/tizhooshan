// Seeded randomness: the same seed always builds the same example, so a
// teacher can share or reprint it.

export type Rng = () => number;

/** mulberry32: small, fast, good enough for building puzzles. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng: Rng, n: number) => Math.floor(rng() * n);

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[randInt(rng, items.length)];

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh seed for "new example". */
export const newSeed = () => Math.floor(Math.random() * 1_000_000);
