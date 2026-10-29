// Pure parser for Instagram's "Followers and following" export
// (connections/followers_and_following/following.json). No Payload imports (only the
// pure helpers in src/lib/validation.ts), so it can be unit tested directly.
//
// Known shapes:
//   older: {"relationships_following": [{"title": "", "string_list_data":
//            [{"href": "https://www.instagram.com/<handle>", "value": "<handle>", "timestamp": 1700000000}]}]}
//   newer: {"relationships_following": [{"title": "<handle>", "string_list_data":
//            [{"href": "https://www.instagram.com/_u/<handle>", "timestamp": 1700000000}]}]}
// Some exports are a bare top-level array of the same entries; that is accepted too.

import { isValidHandle, normalizeHandle } from '../../src/lib/validation'

// Instagram usernames: letters, digits, "." and "_", at most 30 characters.
const HREF_RE = /instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)\/?(?:[?#].*)?$/

export type ParsedAccount = {
  handle: string
  /** When Dimitrij followed the account, if the export says. */
  followedAt?: Date
}

export type InvalidEntry = { index: number; reason: string }

export type ParseResult = {
  /** Unique, normalised handles in export order. */
  accounts: ParsedAccount[]
  /** Handles that appeared more than once in the file (later copies dropped). */
  duplicates: string[]
  invalid: InvalidEntry[]
}

export { isValidHandle, normalizeHandle }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const handleFromHref = (href: unknown): string | undefined => {
  if (typeof href !== 'string') return undefined
  return HREF_RE.exec(href.trim())?.[1]
}

const entriesOf = (data: unknown): unknown[] | undefined => {
  if (Array.isArray(data)) return data
  if (isRecord(data) && Array.isArray(data.relationships_following)) return data.relationships_following
  return undefined
}

export function parseFollowingExport(data: unknown): ParseResult {
  const entries = entriesOf(data)
  if (!entries) {
    throw new Error(
      'Unrecognised export: expected {"relationships_following": [...]} (connections/followers_and_following/following.json).',
    )
  }

  const seen = new Set<string>()
  const result: ParseResult = { accounts: [], duplicates: [], invalid: [] }

  entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      result.invalid.push({ index, reason: 'entry is not an object' })
      return
    }
    const sld = Array.isArray(entry.string_list_data) ? entry.string_list_data : []
    const first: Record<string, unknown> = isRecord(sld[0]) ? sld[0] : {}

    // Prefer the explicit value (older shape), then the title (newer shape), then the URL.
    const candidates = [first.value, entry.title, handleFromHref(first.href)]
    const raw = candidates.find((c): c is string => typeof c === 'string' && c.trim() !== '')
    if (!raw) {
      result.invalid.push({ index, reason: 'no handle in value, title or href' })
      return
    }
    const handle = normalizeHandle(raw)
    if (!isValidHandle(handle)) {
      result.invalid.push({ index, reason: `not a valid Instagram handle: "${raw}"` })
      return
    }
    if (seen.has(handle)) {
      result.duplicates.push(handle)
      return
    }
    seen.add(handle)

    const account: ParsedAccount = { handle }
    if (typeof first.timestamp === 'number' && first.timestamp > 0) {
      account.followedAt = new Date(first.timestamp * 1000)
    }
    result.accounts.push(account)
  })

  return result
}
