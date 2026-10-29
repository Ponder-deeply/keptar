// Fetch other accounts' profiles and post links through the official Instagram
// Graph API "Business Discovery" endpoint. No scraping and no Payload imports,
// so it can be unit tested with a stub `fetch`.
//
// Needs a Meta app, an Instagram professional (business or creator) account of
// our own linked to a Facebook Page, its IG user ID and an access token with
// `instagram_basic`, `instagram_manage_insights` and `pages_read_engagement`
// (`pnpm instagram:token` gets both values). Business Discovery only sees
// other *professional* accounts: personal accounts come back as not found.

const DEFAULT_VERSION = 'v26.0'
const PAGE_SIZE = 50

// Same shape the `works.igUrl` validator accepts.
const IG_POST_RE = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?(\?[^\s]*)?$/

export type GraphConfig = {
  accessToken: string
  igUserId: string
  version?: string
  fetch?: typeof fetch
}

export type IgPost = { url: string; postedAt?: Date }

export type IgProfile = {
  name?: string
  biography?: string
  website?: string
  posts: IgPost[]
  /** Media whose permalink is not a /p/ or /reel/ URL (dropped). */
  skipped: number
}

/** Thrown when Meta rate-limits us; the caller should stop and rerun later. */
export class RateLimitError extends Error {}

type GraphError = { message?: string; code?: number; error_subcode?: number }
type MediaPage = {
  data?: { permalink?: string; timestamp?: string }[]
  paging?: { cursors?: { after?: string }; next?: string }
}
type DiscoveryResponse = {
  business_discovery?: { name?: string; biography?: string; website?: string; media?: MediaPage }
  error?: GraphError
}

// 4, 17, 32, 613: app / user / page / custom rate limits.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613])
// 110 / 2207013: "cannot find user", i.e. personal, private or missing account.
const isNotFound = (e: GraphError) => e.code === 110 || e.error_subcode === 2207013

export function graphConfigFromEnv(env = process.env): GraphConfig | undefined {
  const accessToken = env.INSTAGRAM_ACCESS_TOKEN
  const igUserId = env.INSTAGRAM_USER_ID
  if (!accessToken || !igUserId) return undefined
  return { accessToken, igUserId, version: env.INSTAGRAM_GRAPH_VERSION || undefined }
}

/** Profile and every post link of `handle`, or `null` if Business Discovery can't see it. */
export async function fetchProfile(handle: string, cfg: GraphConfig): Promise<IgProfile | null> {
  const doFetch = cfg.fetch ?? fetch
  const profile: IgProfile = { posts: [], skipped: 0 }
  let after: string | undefined

  for (let page = 0; ; page++) {
    const media = `media${after ? `.after(${after})` : ''}.limit(${PAGE_SIZE}){permalink,timestamp}`
    const fields = `business_discovery.username(${handle}){${page === 0 ? 'name,biography,website,' : ''}${media}}`
    const url =
      `https://graph.facebook.com/${cfg.version ?? DEFAULT_VERSION}/${cfg.igUserId}` +
      `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(cfg.accessToken)}`

    const body = (await (await doFetch(url)).json()) as DiscoveryResponse
    if (body.error) {
      if (isNotFound(body.error)) return null
      if (body.error.code !== undefined && RATE_LIMIT_CODES.has(body.error.code)) {
        throw new RateLimitError(body.error.message ?? 'rate limited')
      }
      throw new Error(body.error.message ?? `Graph API error ${body.error.code}`)
    }

    const bd = body.business_discovery
    if (!bd) return null
    if (page === 0) {
      profile.name = bd.name?.trim() || undefined
      profile.biography = bd.biography?.trim() || undefined
      profile.website = bd.website?.trim() || undefined
    }
    for (const m of bd.media?.data ?? []) {
      if (!m.permalink || !IG_POST_RE.test(m.permalink)) {
        profile.skipped++
        continue
      }
      const postedAt = m.timestamp ? new Date(m.timestamp) : undefined
      profile.posts.push({ url: m.permalink, postedAt: postedAt && !isNaN(+postedAt) ? postedAt : undefined })
    }

    after = bd.media?.paging?.next ? bd.media.paging.cursors?.after : undefined
    if (!after) return profile
  }
}

// --- Access setup (`pnpm instagram:token`) -----------------------------------

/** Permissions Business Discovery needs; `pages_show_list` lets us find the Page. */
export const REQUIRED_PERMISSIONS = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_read_engagement',
  'pages_show_list',
]

export type IgAccount = { igUserId: string; username?: string; pageName?: string }

export type AccessSetup = {
  /** Long-lived user token (about 60 days). */
  accessToken: string
  expiresAt?: Date
  missingPermissions: string[]
  /** Instagram professional accounts linked to the user's Facebook Pages. */
  accounts: IgAccount[]
}

export type SetupConfig = { appId: string; appSecret: string; version?: string; fetch?: typeof fetch }

async function graphGet<T>(path: string, params: Record<string, string>, cfg: SetupConfig): Promise<T> {
  const url = `https://graph.facebook.com/${cfg.version ?? DEFAULT_VERSION}/${path}?${new URLSearchParams(params)}`
  const body = (await (await (cfg.fetch ?? fetch)(url)).json()) as T & { error?: GraphError }
  if (body.error) throw new Error(body.error.message ?? `Graph API error ${body.error.code}`)
  return body
}

/**
 * Exchanges a short-lived user token (e.g. from the Graph API Explorer) for a
 * long-lived one and finds the Instagram professional accounts it can use.
 */
export async function setupAccess(shortLivedToken: string, cfg: SetupConfig): Promise<AccessSetup> {
  const exchanged = await graphGet<{ access_token: string; expires_in?: number }>(
    'oauth/access_token',
    {
      grant_type: 'fb_exchange_token',
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: shortLivedToken,
    },
    cfg,
  )
  const accessToken = exchanged.access_token

  const perms = await graphGet<{ data?: { permission: string; status: string }[] }>(
    'me/permissions',
    { access_token: accessToken },
    cfg,
  )
  const granted = new Set((perms.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission))

  const pages = await graphGet<{
    data?: { name?: string; instagram_business_account?: { id: string; username?: string } }[]
  }>('me/accounts', { fields: 'name,instagram_business_account{id,username}', access_token: accessToken }, cfg)

  return {
    accessToken,
    expiresAt: exchanged.expires_in ? new Date(Date.now() + exchanged.expires_in * 1000) : undefined,
    missingPermissions: REQUIRED_PERMISSIONS.filter((p) => !granted.has(p)),
    accounts: (pages.data ?? []).flatMap((p) =>
      p.instagram_business_account
        ? [{ igUserId: p.instagram_business_account.id, username: p.instagram_business_account.username, pageName: p.name }]
        : [],
    ),
  }
}
