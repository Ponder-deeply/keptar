// Import Dimitrij's Instagram following list as pending artists, with all their
// posts as Instagram-embed works.
//
//   pnpm import:instagram <path/to/following.json | inscrape-export.json> [--dry-run] [--handles-only] [--update-posts]
//
// One `artists` record per followed account: status "pending". By default each
// new artist's name, bio, website and every post link come from the Instagram
// Graph API (Business Discovery, see scripts/lib/instagram-graph.ts; needs
// INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID). Each post becomes a `works`
// record with source "instagram". Personal accounts are invisible to that API,
// so they are created with the handle only and their posts are added by hand.
//
// An inscrape export (~/Projects/inscrape, detected by its "source" field) is
// read instead of the API: name, bio and post links come from the file, and no
// token is needed. Accounts inscrape hasn't scraped (or found private, missing
// or empty) are created handle-only; import a later run with --update-posts.
//
// --handles-only  skip the API: handle-only artists, no works.
// --update-posts  also add posts not yet stored to artists already in the
//                 database (pending or published only). Their other fields are
//                 never touched, because the curator may have edited them.
//
// Idempotent: existing handles are not recreated, and a post URL already stored
// for an artist is not added again. If Meta rate-limits us the run stops early;
// rerun it later (with --update-posts to finish half-fetched artists).
import fs from 'node:fs/promises'
import { getPayload } from 'payload'

import { parseIgPermalink } from '../src/components/igPermalink'
import config from '../src/payload.config'
import { parseArgs } from './lib/args'
import { isInscrapeExport, parseInscrapeExport } from './lib/inscrape-export'
import { parseFollowingExport } from './lib/instagram-export'
import {
  fetchProfile,
  graphConfigFromEnv,
  RateLimitError,
  type IgPost,
  type IgProfile,
} from './lib/instagram-graph'

const USAGE =
  'Usage: pnpm import:instagram <path/to/following.json | inscrape-export.json> [--dry-run] [--handles-only] [--update-posts]'
const FLAGS = ['dry-run', 'handles-only', 'update-posts']

const args = parseArgs(process.argv.slice(2))
const file = args.positional[0]
const dryRun = args.flags.has('dry-run')
const handlesOnly = args.flags.has('handles-only')
const updatePosts = args.flags.has('update-posts')
const unknown = [...args.flags].filter((f) => !FLAGS.includes(f))
if (!file || unknown.length || args.positional.length > 1) {
  console.error(unknown.length ? `Unknown flag(s): ${unknown.map((f) => `--${f}`).join(' ')}` : USAGE)
  if (unknown.length) console.error(USAGE)
  process.exit(1)
}

if (handlesOnly && updatePosts) {
  console.error('--update-posts adds posts; it cannot be combined with --handles-only.')
  process.exit(1)
}

type Account = { handle: string; status?: string; profile?: IgProfile }
let parsed: { accounts: Account[]; duplicates: string[]; invalid: { index: number; reason: string }[] }
let fromInscrape = false
try {
  const data: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
  fromInscrape = isInscrapeExport(data)
  parsed = fromInscrape ? parseInscrapeExport(data) : parseFollowingExport(data)
} catch (err) {
  console.error(`Cannot read ${file}: ${(err as Error).message}`)
  process.exit(1)
}

const graph = handlesOnly || fromInscrape ? undefined : graphConfigFromEnv()
if (!handlesOnly && !fromInscrape && !graph) {
  console.error(
    'Fetching posts needs INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID (see .env.example).\n' +
      'Run with --handles-only to import just the handles.',
  )
  process.exit(1)
}
const withPosts = !handlesOnly

const payload = await getPayload({ config })

const existing = new Map(
  (
    await payload.find({
      collection: 'artists',
      where: { handle: { in: parsed.accounts.map((a) => a.handle) } },
      pagination: false,
      depth: 0,
      select: { handle: true, status: true },
      overrideAccess: true,
    })
  ).docs.map((d) => [d.handle, d]),
)

const created: string[] = []
const skippedExisting: string[] = []
const personal: { handle: string; status?: string }[] = []
const failed: { handle: string; error: string }[] = []
let worksAdded = 0
let rateLimited: string | undefined

/** Adds the posts not yet stored for the artist; returns how many were (or would be) added. */
async function addWorks(artistId: number | undefined, posts: IgPost[]): Promise<number> {
  let known = new Set<string>()
  if (artistId !== undefined) {
    const { docs } = await payload.find({
      collection: 'works',
      where: { artist: { equals: artistId } },
      pagination: false,
      depth: 0,
      select: { igUrl: true },
      overrideAccess: true,
    })
    // Compare canonical permalinks: a hand-pasted URL may differ (no www, ?igsh=…).
    known = new Set(docs.flatMap((d) => parseIgPermalink(d.igUrl) ?? []))
  }
  // Both sources list newest first (inscrape: pinned posts on top); create oldest
  // first so "newest" sorting matches Instagram.
  const fresh = posts.filter((p) => !known.has(parseIgPermalink(p.url) ?? p.url)).reverse()
  if (dryRun || artistId === undefined) return fresh.length
  for (const post of fresh) {
    await payload.create({
      collection: 'works',
      data: { artist: artistId, source: 'instagram', igUrl: post.url },
      overrideAccess: true,
    })
  }
  return fresh.length
}

for (const account of parsed.accounts) {
  const { handle } = account
  const current = existing.get(handle)
  if (current && !(updatePosts && ['pending', 'published'].includes(current.status))) {
    skippedExisting.push(handle)
    continue
  }
  try {
    const profile = !withPosts ? undefined : fromInscrape ? account.profile : await fetchProfile(handle, graph!)
    if (withPosts && !profile) personal.push({ handle, status: account.status })

    let artistId = current?.id
    if (!current) {
      if (!dryRun) {
        const artist = await payload.create({
          collection: 'artists',
          data: {
            handle,
            name: profile?.name || handle,
            bio: profile?.biography,
            website: profile?.website,
            status: 'pending',
          },
          overrideAccess: true,
        })
        artistId = artist.id
      }
      created.push(handle)
    }
    if (profile) worksAdded += await addWorks(artistId, profile.posts)
  } catch (err) {
    if (err instanceof RateLimitError) {
      rateLimited = `${handle}: ${err.message}`
      break
    }
    failed.push({ handle, error: (err as Error).message })
  }
}

const verb = dryRun ? 'would create' : 'created'
console.log(`\nInstagram import${dryRun ? ' (dry run, nothing written)' : ''}: ${file}`)
console.log(`  ${verb}:  ${created.length}${created.length ? `  (${created.join(', ')})` : ''}`)
if (withPosts) {
  console.log(`  works ${dryRun ? 'to add' : 'added'}: ${worksAdded}`)
  if (fromInscrape) {
    const byStatus = new Map<string, typeof personal>()
    for (const p of personal) byStatus.set(p.status ?? 'pending', [...(byStatus.get(p.status ?? 'pending') ?? []), p])
    console.log(`  no posts in the file: ${personal.length}`)
    for (const [status, list] of byStatus) {
      console.log(`    ${status}: ${list.length}  (${list.map((p) => p.handle).join(', ')})`)
    }
  } else {
    console.log(
      `  no posts (personal, private or renamed account): ${personal.length}` +
        `${personal.length ? `  (${personal.map((p) => p.handle).join(', ')})` : ''}`,
    )
  }
}
console.log(
  `  skipped:  ${skippedExisting.length + parsed.duplicates.length}` +
    `  (${skippedExisting.length} already in DB, ${parsed.duplicates.length} duplicate in file)`,
)
console.log(`  invalid:  ${parsed.invalid.length}`)
for (const { index, reason } of parsed.invalid) console.log(`    #${index}: ${reason}`)
if (failed.length) {
  console.log(`  failed:   ${failed.length}`)
  for (const { handle, error } of failed) console.log(`    ${handle}: ${error}`)
  console.log('  Rerun with --update-posts to add the missing posts of artists created before the error.')
}
if (rateLimited) {
  console.log(`  stopped: rate-limited by Meta at ${rateLimited}`)
  console.log('  Rerun later with --update-posts to continue.')
}

process.exit(failed.length || rateLimited ? 1 : 0)
