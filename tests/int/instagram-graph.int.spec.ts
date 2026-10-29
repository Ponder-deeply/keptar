import { describe, expect, it } from 'vitest'

import { fetchProfile, RateLimitError, setupAccess } from '../../scripts/lib/instagram-graph'

// Stub `fetch` that returns the given Graph API bodies in order and records the URLs.
const stub = (...bodies: unknown[]) => {
  const urls: string[] = []
  const fetch = (async (url: string) => {
    urls.push(decodeURIComponent(url))
    return { json: async () => bodies.shift() }
  }) as unknown as typeof globalThis.fetch
  return { urls, cfg: { accessToken: 't', igUserId: '17841400000000000', fetch } }
}

const post = (code: string, timestamp = '2025-03-01T10:00:00+0000') => ({
  permalink: `https://www.instagram.com/p/${code}/`,
  timestamp,
})

describe('fetchProfile', () => {
  it('reads the profile and follows media pagination', async () => {
    const { urls, cfg } = stub(
      {
        business_discovery: {
          name: ' Kiss Éva ',
          biography: 'Festő, Budapest',
          media: { data: [post('AAA'), post('BBB')], paging: { cursors: { after: 'CUR' }, next: 'x' } },
        },
      },
      {
        business_discovery: {
          media: {
            data: [post('CCC'), { permalink: 'https://www.instagram.com/tv/DDD/' }],
            paging: { cursors: { after: 'END' } },
          },
        },
      },
    )
    const profile = await fetchProfile('kiss.eva', cfg)
    expect(profile).toMatchObject({ name: 'Kiss Éva', biography: 'Festő, Budapest', website: undefined, skipped: 1 })
    expect(profile?.posts.map((p) => p.url)).toEqual([
      'https://www.instagram.com/p/AAA/',
      'https://www.instagram.com/p/BBB/',
      'https://www.instagram.com/p/CCC/',
    ])
    expect(profile?.posts[0].postedAt).toEqual(new Date('2025-03-01T10:00:00Z'))
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('business_discovery.username(kiss.eva){name,biography,website,media.limit(50)')
    expect(urls[1]).toContain('media.after(CUR).limit(50)')
  })

  it('returns null for accounts Business Discovery cannot see', async () => {
    const { cfg } = stub({ error: { message: 'Invalid user id', code: 110, error_subcode: 2207013 } })
    expect(await fetchProfile('personal.acc', cfg)).toBeNull()
  })

  it('throws RateLimitError on rate limits and Error otherwise', async () => {
    await expect(fetchProfile('a', stub({ error: { code: 4, message: 'slow down' } }).cfg)).rejects.toBeInstanceOf(
      RateLimitError,
    )
    await expect(fetchProfile('a', stub({ error: { code: 190, message: 'bad token' } }).cfg)).rejects.toThrow(
      'bad token',
    )
  })
})

describe('setupAccess', () => {
  const setupCfg = (fetch: typeof globalThis.fetch) => ({ appId: 'app', appSecret: 'secret', fetch })

  it('exchanges the token and finds the linked Instagram account', async () => {
    const { urls, cfg } = stub(
      { access_token: 'LONG', expires_in: 5184000 },
      {
        data: [
          { permission: 'instagram_basic', status: 'granted' },
          { permission: 'instagram_manage_insights', status: 'granted' },
          { permission: 'pages_read_engagement', status: 'granted' },
          { permission: 'pages_show_list', status: 'declined' },
        ],
      },
      {
        data: [
          { name: 'Other Page' },
          { name: 'Képtár', instagram_business_account: { id: '1784', username: 'keptar.hu' } },
        ],
      },
    )
    const setup = await setupAccess('SHORT', setupCfg(cfg.fetch))
    expect(setup).toMatchObject({
      accessToken: 'LONG',
      missingPermissions: ['pages_show_list'],
      accounts: [{ igUserId: '1784', username: 'keptar.hu', pageName: 'Képtár' }],
    })
    expect(setup.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 86400_000)
    expect(urls[0]).toContain('oauth/access_token?grant_type=fb_exchange_token&client_id=app')
    expect(urls[0]).toContain('fb_exchange_token=SHORT')
    expect(urls[2]).toContain('access_token=LONG')
  })

  it('reports Graph API errors', async () => {
    const { cfg } = stub({ error: { code: 190, message: 'Session has expired' } })
    await expect(setupAccess('OLD', setupCfg(cfg.fetch))).rejects.toThrow('Session has expired')
  })
})
