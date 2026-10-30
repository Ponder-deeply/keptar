import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { isInscrapeExport, parseInscrapeExport } from '../../scripts/lib/inscrape-export'

describe('parseInscrapeExport', () => {
  const data = JSON.parse(fs.readFileSync('scripts/fixtures/inscrape.sample.json', 'utf8'))

  it('detects inscrape exports and nothing else', () => {
    expect(isInscrapeExport(data)).toBe(true)
    expect(isInscrapeExport({ relationships_following: [] })).toBe(false)
    expect(isInscrapeExport({ accounts: [] })).toBe(false)
    expect(() => parseInscrapeExport({ relationships_following: [] })).toThrow(/Unrecognised export/)
  })

  it('parses the sample fixture', () => {
    const { accounts, duplicates, invalid } = parseInscrapeExport(data)
    expect(accounts.map((a) => [a.handle, a.status])).toEqual([
      ['fake.kovacs.festo', 'ok'],
      ['fake.szabo.grafika', 'ok'],
      ['fake.ures.profil', 'no_posts_found'],
      ['fake.nem.lekert', 'pending'],
    ])
    expect(duplicates).toEqual(['fake.kovacs.festo'])
    expect(invalid.map((i) => i.index)).toEqual([5, 6])
  })

  it('keeps grid order, canonicalises and dedupes post URLs, drops /tv/', () => {
    const [kovacs] = parseInscrapeExport(data).accounts
    expect(kovacs.profile).toEqual({
      name: 'Kovács Péter',
      biography: 'Festő\nBudapest',
      posts: [
        { url: 'https://www.instagram.com/p/FAKEpin01/' },
        { url: 'https://www.instagram.com/reel/FAKEreel1/' },
        { url: 'https://www.instagram.com/p/FAKEpost1/' },
      ],
      skipped: 1,
    })
  })

  it('gives a profile only to "ok" accounts, with null names left unset', () => {
    const [, szabo, ures, nemLekert] = parseInscrapeExport(data).accounts
    expect(szabo.profile?.name).toBeUndefined()
    expect(szabo.profile?.biography).toBeUndefined()
    expect(ures.profile).toBeUndefined()
    expect(nemLekert.profile).toBeUndefined()
  })
})
