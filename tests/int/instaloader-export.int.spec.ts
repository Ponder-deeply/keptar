import { describe, expect, it } from 'vitest'

import { parseInstaloaderExport, readInstaloaderExport } from '../../scripts/lib/instaloader-export'

const ROOT = 'scripts/fixtures/instaloader.sample'

describe('instaloader export', () => {
  it('reads every profile directory, or a single profile directory', async () => {
    const dirs = await readInstaloaderExport(ROOT)
    expect(dirs.map((d) => d.name)).toEqual(['fake.kovacs.festo', 'fake.privat.grafika', 'torott'])
    expect(dirs[2].unreadable).toEqual(['torott_1000003.json'])

    const single = await readInstaloaderExport(`${ROOT}/fake.kovacs.festo`)
    expect(single.map((d) => d.name)).toEqual(['fake.kovacs.festo'])
  })

  it('parses the sample fixture', async () => {
    const { accounts, duplicates, invalid } = parseInstaloaderExport(await readInstaloaderExport(ROOT))
    expect(accounts.map((a) => [a.handle, a.status])).toEqual([
      ['fake.kovacs.festo', 'ok'],
      ['fake.privat.grafika', 'private'],
    ])
    expect(duplicates).toEqual([])
    expect(invalid).toEqual([
      { index: 2, reason: 'torott/torott_1000003.json: unreadable JSON' },
      { index: 2, reason: 'torott: no profile metadata (was --no-metadata-json used?)' },
    ])
  })

  it('sorts posts newest first, dedupes them and drops bad shortcodes', async () => {
    const [kovacs] = parseInstaloaderExport(await readInstaloaderExport(ROOT)).accounts
    expect(kovacs.profile).toEqual({
      name: 'Kovács Péter',
      biography: 'Festő\nBudapest',
      website: 'https://kovacs-festo.example',
      posts: [
        { url: 'https://www.instagram.com/p/FAKEnew01/', postedAt: new Date('2026-09-15T10:00:00Z') },
        { url: 'https://www.instagram.com/p/FAKEmid01/', postedAt: new Date('2026-06-01T10:00:00Z') },
        { url: 'https://www.instagram.com/p/FAKEold01/', postedAt: new Date('2026-03-01T10:00:00Z') },
      ],
      skipped: 1,
    })
  })

  it('keeps the name of a private profile and leaves blanks unset', async () => {
    const [, privat] = parseInstaloaderExport(await readInstaloaderExport(ROOT)).accounts
    expect(privat.profile).toEqual({ name: 'Szabó Anna', biography: undefined, website: undefined, posts: [], skipped: 0 })
  })

  it('reports duplicate handles across directories', () => {
    const profile = {
      instaloader: { node_type: 'Profile' },
      node: { username: 'fake.kovacs.festo', full_name: 'K' },
    }
    const { accounts, duplicates } = parseInstaloaderExport([
      { name: 'a', structures: [profile], unreadable: [] },
      { name: 'b', structures: [profile], unreadable: [] },
    ])
    expect(accounts).toHaveLength(1)
    expect(duplicates).toEqual(['fake.kovacs.festo'])
  })
})
