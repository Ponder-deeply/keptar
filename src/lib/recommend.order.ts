// Client-safe helpers for the swipe order (no Payload imports).

/** Small deterministic PRNG (mulberry32); returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates shuffle driven by `seed`; the same seed gives the same order. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items]
  const rand = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Swipe order: each tier is shuffled on its own and the tiers are concatenated,
 * so earlier tiers (e.g. recommended works) come first. Ids appearing in an
 * earlier tier are dropped from later ones.
 */
export function swipeOrder(tiers: readonly (readonly number[])[], seed: number): number[] {
  const used = new Set<number>()
  const order: number[] = []
  tiers.forEach((tier, i) => {
    const fresh: number[] = []
    for (const id of tier) {
      if (used.has(id)) continue
      used.add(id)
      fresh.push(id)
    }
    order.push(...seededShuffle(fresh, seed + i))
  })
  return order
}
