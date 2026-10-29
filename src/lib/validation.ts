// Input checks shared by the collections, endpoints, server actions and scripts.
// Pure functions, safe on client and server.

export const EMAIL_MAX = 254
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A plausible email address (no full RFC parsing; the mail provider has the last word). */
export const isValidEmail = (value: string): boolean => value.length <= EMAIL_MAX && EMAIL_RE.test(value)

/** Instagram usernames: up to 30 lowercase letters, digits, dots and underscores. */
export const HANDLE_RE = /^[a-z0-9._]{1,30}$/

/** Trims, drops a leading @ and lowercases. Used by the `artists.handle` hook too. */
export const normalizeHandle = (raw: string): string => raw.trim().replace(/^@/, '').toLowerCase()

export const isValidHandle = (handle: string): boolean => HANDLE_RE.test(handle)

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
