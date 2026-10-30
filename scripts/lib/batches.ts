// Pure helpers for scripts/instaloader-batches.ts, unit tested directly.

/** Splits `items` into `count` contiguous sections whose sizes differ by at most one. */
export function splitIntoSections<T>(items: T[], count: number): T[][] {
  if (!Number.isInteger(count) || count < 1) throw new Error(`section count must be a positive integer, got ${count}`)
  const n = Math.min(count, items.length)
  const sections: T[][] = []
  let start = 0
  for (let i = 0; i < n; i++) {
    // The first (length % n) sections get one extra item.
    const size = Math.floor(items.length / n) + (i < items.length % n ? 1 : 0)
    sections.push(items.slice(start, start + size))
    start += size
  }
  return sections
}

const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000 }

/** Parses "90", "90s", "30m", "1.5h" (a bare number is seconds) into milliseconds. */
export function parseDuration(value: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*([smh]?)$/i.exec(value.trim())
  if (!match) throw new Error(`not a duration: "${value}" (use e.g. 90s, 30m, 2h)`)
  return Math.round(Number(match[1]) * UNIT_MS[(match[2] || 's').toLowerCase()])
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s % 3600 === 0 && s) return `${s / 3600}h`
  if (s % 60 === 0 && s) return `${s / 60}m`
  return `${s}s`
}
