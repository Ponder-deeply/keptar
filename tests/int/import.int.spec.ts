import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseFollowingExport } from '../../scripts/lib/instagram-export'

const entry = (sld: Record<string, unknown>, title = '') => ({ title, string_list_data: [sld] })

describe('parseFollowingExport', () => {
  it('reads the older shape (handle in string_list_data[0].value)', () => {
    const { accounts, invalid } = parseFollowingExport({
      relationships_following: [
        entry({ href: 'https://www.instagram.com/kiss.eva', value: 'kiss.eva', timestamp: 1700000000 }),
      ],
    })
    expect(invalid).toEqual([])
    expect(accounts).toEqual([{ handle: 'kiss.eva', followedAt: new Date(1700000000 * 1000) }])
  })

  it('reads the newer shape (handle in title, no value)', () => {
    const { accounts } = parseFollowingExport({
      relationships_following: [
        entry({ href: 'https://www.instagram.com/_u/kiss.eva', timestamp: 1700000000 }, 'kiss.eva'),
      ],
    })
    expect(accounts.map((a) => a.handle)).toEqual(['kiss.eva'])
  })

  it('falls back to the href and accepts a bare top-level array', () => {
    const { accounts } = parseFollowingExport([entry({ href: 'https://www.instagram.com/_u/Kiss_Eva/' })])
    expect(accounts.map((a) => a.handle)).toEqual(['kiss_eva'])
  })

  it('normalises like the artists.handle hook and drops duplicates', () => {
    const { accounts, duplicates } = parseFollowingExport({
      relationships_following: [entry({ value: '@Kiss.Eva ' }), entry({}, 'kiss.eva')],
    })
    expect(accounts.map((a) => a.handle)).toEqual(['kiss.eva'])
    expect(duplicates).toEqual(['kiss.eva'])
  })

  it('reports malformed entries with their index', () => {
    const { accounts, invalid } = parseFollowingExport({
      relationships_following: [null, { title: '', string_list_data: [] }, entry({}, 'not a handle!'), 'x'],
    })
    expect(accounts).toEqual([])
    expect(invalid.map((i) => i.index)).toEqual([0, 1, 2, 3])
  })

  it('rejects files that are not a following export', () => {
    expect(() => parseFollowingExport({ relationships_followers: [] })).toThrow(/Unrecognised export/)
  })

  it('parses the sample fixture', () => {
    const data = JSON.parse(fs.readFileSync('scripts/fixtures/following.sample.json', 'utf8'))
    const { accounts, duplicates, invalid } = parseFollowingExport(data)
    expect(accounts).toHaveLength(10)
    expect(duplicates).toEqual(['fake.horvath.lili.art'])
    expect(invalid).toHaveLength(2)
    expect(accounts.map((a) => a.handle)).toContain('fake.varga.grafika')
  })
})
