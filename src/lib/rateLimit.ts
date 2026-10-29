/**
 * Simple fixed-window rate limits, keyed by e.g. client IP or email.
 *
 * The state lives in this process's memory: it resets on restart and is not
 * shared between processes or instances. That is enough for the single-VPS
 * deployment; with several instances, move it to the database or Redis.
 */
const MAX_KEYS = 10_000

export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>()

  /** Records an attempt and returns true if the key is still within its limit. */
  return function allow(key: string, now = Date.now()): boolean {
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
      if (hits.size >= MAX_KEYS) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
        // Still full (a flood of distinct keys): drop the oldest entry.
        if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value as string)
      }
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }
    entry.count += 1
    return entry.count <= max
  }
}

/** Inquiry form: 5 per hour per IP. */
export const allowInquiry = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 })

/** Claim/remove profile requests: 5 per hour per IP. */
export const allowProfileRequest = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 })

/**
 * Client IP from proxy headers, or 'unknown'. Takes the *last* X-Forwarded-For
 * entry: that is the one our own proxy (Caddy) added; earlier entries are
 * client-controlled and can be spoofed.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',').at(-1)!.trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
