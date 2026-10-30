// Pure parser for inscrape's export (~/Projects/inscrape, `npm run scrape`): a
// browser-scraped list of profiles with their latest post links. No Payload
// imports, so it can be unit tested directly.
//
// Shape:
//   {"source": "inscrape", "generatedAt": "…", "accounts": [{"username": "<handle>",
//     "status": "ok" | "pending" | "private" | "no_posts_found" | …,
//     "fullName": "…" | null, "biography": "…" | null,
//     "posts": [{"kind": "p" | "reel", "shortcode": "…", "url": "https://www.instagram.com/p/…/", "pinned": false}]}]}
// Only "ok" accounts carry profile data; every other status (not scraped yet,
// private, missing, empty) is imported handle-only.

import { IG_POST_URL_RE, parseIgPermalink } from '../../src/components/igPermalink'
import { isValidHandle, normalizeHandle } from '../../src/lib/validation'
import type { InvalidEntry } from './instagram-export'
import type { IgProfile } from './instagram-graph'

export type InscrapeAccount = {
  handle: string
  /** inscrape's status for the account ("ok", "pending", "private", …). */
  status: string
  /** Set only for "ok" accounts. Posts are in profile-grid order (pinned first, then newest first). */
  profile?: IgProfile
}

export type InscrapeResult = {
  accounts: InscrapeAccount[]
  duplicates: string[]
  invalid: InvalidEntry[]
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

export const isInscrapeExport = (data: unknown): boolean =>
  isRecord(data) && data.source === 'inscrape' && Array.isArray(data.accounts)

export function parseInscrapeExport(data: unknown): InscrapeResult {
  if (!isInscrapeExport(data)) {
    throw new Error('Unrecognised export: expected {"source": "inscrape", "accounts": [...]}.')
  }
  const entries = (data as { accounts: unknown[] }).accounts

  const seen = new Set<string>()
  const result: InscrapeResult = { accounts: [], duplicates: [], invalid: [] }

  entries.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.username !== 'string') {
      result.invalid.push({ index, reason: 'entry has no username' })
      return
    }
    const handle = normalizeHandle(entry.username)
    if (!isValidHandle(handle)) {
      result.invalid.push({ index, reason: `not a valid Instagram handle: "${entry.username}"` })
      return
    }
    if (seen.has(handle)) {
      result.duplicates.push(handle)
      return
    }
    seen.add(handle)

    const status = text(entry.status) ?? 'pending'
    const account: InscrapeAccount = { handle, status }
    if (status === 'ok') {
      const posts: IgProfile['posts'] = []
      const urls = new Set<string>()
      let skipped = 0
      for (const post of Array.isArray(entry.posts) ? entry.posts : []) {
        const url = isRecord(post) ? parseIgPermalink(text(post.url)) : null
        // works.igUrl only accepts /p/ and /reel/ (no /tv/).
        if (!url || !IG_POST_URL_RE.test(url)) skipped++
        else if (!urls.has(url)) {
          urls.add(url)
          posts.push({ url })
        }
      }
      account.profile = { name: text(entry.fullName), biography: text(entry.biography), posts, skipped }
    }
    result.accounts.push(account)
  })

  return result
}
