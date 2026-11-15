// Written with the help of Claude
/** A shuffle seeded with mulberry32, so the same seed always gives the same order (FUNC-001). */
export function shuffled<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return items
    .map((item) => ({ item, key: random() }))
    .sort((x, y) => x.key - y.key)
    .map(({ item }) => item);
}
