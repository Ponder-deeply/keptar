/**
 * Simple fixed-window rate limit for the inquiry form, keyed by client IP.
 *
 * The state lives in this process's memory: it resets on restart and is not
 * shared between processes or instances. That is enough for the single-VPS
 * deployment; with several instances, move it to the database or Redis.
 */
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const MAX_KEYS = 10_000

const hits = new Map<string, { count: number; resetAt: number }>()

/** Records an attempt and returns true if the key is still within its limit. */
export function allowInquiry(key: string, now = Date.now()): boolean {
  const entry = hits.get(key)
  if (!entry || entry.resetAt <= now) {
    if (hits.size >= MAX_KEYS) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
      // Still full (a flood of distinct IPs): drop the oldest entry.
      if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value as string)
    }
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= MAX_PER_WINDOW
}

/** Client IP from proxy headers (Caddy sets X-Forwarded-For), or 'unknown'. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
