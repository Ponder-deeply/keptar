// Propose medium / technique / subject tags and a region for artists with Claude.
//
//   pnpm tag:artists [--dry-run] [--handle <h>] [--force] [--create-tags] [--limit <n>]
//
// Input per artist: name, handle, bio, city, website, and the images of their
// `upload` works (from `media`). Instagram images are never fetched: that would
// mean scraping. Imported artists usually have only a handle, so expect sparse,
// low-confidence proposals until the curator adds a bio or works.
//
// Targets: artists with status "pending" that are not yet `aiTagged`
// (`--force` includes those), or exactly one artist with `--handle`.
//
// Writing (skipped with --dry-run, which prints the proposals as JSON):
// - `medium`, `technique`, `region` are filled only when empty, unless --force.
//   `aiTagged` is set to true whenever one of them is written.
// - Proposals only use existing `tags` (by slug, per kind) and `REGIONS` values;
//   the prompt lists the vocabulary and anything else in the reply is dropped
//   (reported as `dropped` in the JSON output).
// - Unknown-tag policy: tags Claude thinks are missing from the vocabulary are
//   NOT created by default. They are printed and listed in a marked block of
//   `curatorNotes`, so the curator decides whether the public vocabulary grows.
//   `--create-tags` creates them (slug from the name) and assigns medium /
//   technique ones like any other proposal.
// - Subject tags have no field on `artists`, so they also go into that block.
//   The curator's own notes outside the block are never touched; the block is
//   replaced on each run.
import fs from 'node:fs/promises'
import path from 'node:path'

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { getPayload, type Payload } from 'payload'
import { z } from 'zod'

import config from '../src/payload.config'
import { REGIONS } from '../src/fields/regions'
import { slugify } from '../src/fields/slugify'
import type { Artist, Media, Tag } from '../src/payload-types'
import { parseArgs } from './lib/args'
import { serverURL } from '../src/lib/serverURL'

const MODEL = 'claude-sonnet-5-5'
const MAX_IMAGES = 6
const NOTES_START = '--- MI-javaslat'
const NOTES_END = '--- MI-javaslat vége ---'
const USAGE =
  'Usage: pnpm tag:artists [--dry-run] [--handle <h>] [--force] [--create-tags] [--limit <n>]'

type Kind = Tag['kind']
const KINDS: Kind[] = ['medium', 'technique', 'subject']
const KIND_HU: Record<Kind, string> = { medium: 'médium', technique: 'technika', subject: 'téma' }

// ---------------------------------------------------------------- arguments

const KNOWN_FLAGS = ['dry-run', 'force', 'create-tags']
let args
try {
  args = parseArgs(process.argv.slice(2), ['handle', 'limit'])
} catch (err) {
  console.error(`${(err as Error).message}\n${USAGE}`)
  process.exit(1)
}
const unknownFlags = [...args.flags].filter((f) => !KNOWN_FLAGS.includes(f))
if (unknownFlags.length || args.positional.length) {
  console.error(`Unexpected argument(s): ${[...unknownFlags.map((f) => `--${f}`), ...args.positional].join(' ')}`)
  console.error(USAGE)
  process.exit(1)
}
const dryRun = args.flags.has('dry-run')
const force = args.flags.has('force')
const createTags = args.flags.has('create-tags')
const onlyHandle = args.values.get('handle')?.trim().replace(/^@/, '').toLowerCase()
const limit = args.values.has('limit') ? Number(args.values.get('limit')) : undefined
if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) {
  console.error('--limit must be a positive integer')
  process.exit(1)
}

if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error(
    'ANTHROPIC_API_KEY is not set. The tagging script calls Claude for every artist (also with --dry-run),\n' +
      'so it needs a key: add ANTHROPIC_API_KEY=... to .env or export it, then re-run.',
  )
  process.exit(1)
}

// ---------------------------------------------------------------- data

const payload = await getPayload({ config })
const anthropic = new Anthropic({ maxRetries: 4 })

const allTags = (await payload.find({ collection: 'tags', pagination: false, depth: 0, overrideAccess: true }))
  .docs
const tagsByKind = (kind: Kind) => allTags.filter((t) => t.kind === kind)
const tagBySlug = new Map(allTags.map((t) => [t.slug, t]))

const artists = (
  await payload.find({
    collection: 'artists',
    where: onlyHandle
      ? { handle: { equals: onlyHandle } }
      : force
        ? { status: { equals: 'pending' } }
        : { and: [{ status: { equals: 'pending' } }, { aiTagged: { not_equals: true } }] },
    sort: 'handle',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
).docs.slice(0, limit)

if (onlyHandle && !artists.length) {
  console.error(`No artist with handle "${onlyHandle}".`)
  process.exit(1)
}

// ---------------------------------------------------------------- prompt + schema

// Slug lists are plain strings on the wire: this SDK version moves `enum` into
// the description rather than sending it as a constraint, and a single stray
// slug would then fail zod parsing for the whole artist. `sanitize` below drops
// anything outside the vocabulary instead, and reports it.
const slugList = (kind: Kind) => z.array(z.string()).describe(`Existing ${kind} tag slugs that apply.`)

const ResponseSchema = z.object({
  likelyArtist: z
    .enum(['yes', 'no', 'unclear'])
    .describe('Is this account a visual artist (not a friend, brand, gallery, shop)?'),
  medium: slugList('medium'),
  technique: slugList('technique'),
  subject: slugList('subject'),
  region: z.string().describe('Region slug from the list, or "unknown" when there is no evidence.'),
  newTags: z
    .array(
      z.object({
        kind: z.enum(['medium', 'technique', 'subject']),
        name: z.string().describe('Hungarian tag name, e.g. "Textil".'),
      }),
    )
    .describe('Clearly applicable tags missing from the vocabulary. Usually empty.'),
  confidence: z.enum(['low', 'medium', 'high']),
  rationale: z.string().describe('One or two short Hungarian sentences for the curator.'),
})
type Proposal = z.infer<typeof ResponseSchema> & {
  /** Slugs / region values Claude returned that are not in the vocabulary (dropped). */
  dropped: string[]
}

const REGION_VALUES = new Set<string>(REGIONS.map((r) => r.value))

/** Keep only existing slugs of the right kind and a known region. */
function sanitize(raw: z.infer<typeof ResponseSchema>): Proposal {
  const dropped: string[] = []
  const keep = (kind: Kind, slugs: string[]) =>
    [...new Set(slugs)].filter((slug) => {
      const ok = tagBySlug.get(slug)?.kind === kind
      if (!ok) dropped.push(`${kind}:${slug}`)
      return ok
    })
  const region = raw.region === 'unknown' || REGION_VALUES.has(raw.region) ? raw.region : 'unknown'
  if (region !== raw.region) dropped.push(`region:${raw.region}`)
  return {
    ...raw,
    medium: keep('medium', raw.medium),
    technique: keep('technique', raw.technique),
    subject: keep('subject', raw.subject),
    region,
    dropped,
  }
}

const vocabulary = KINDS.map(
  (kind) =>
    `${kind}:\n` +
    (tagsByKind(kind)
      .map((t) => `  - ${t.slug} (${t.name})`)
      .join('\n') || '  (none yet)'),
).join('\n')

const SYSTEM = `You help the curator of Képtár, a non-profit showcase of contemporary Hungarian visual artists, triage accounts imported from the curator's Instagram following list.

For one account you get what is known: handle, name, maybe a bio, city, website, and images of works. Propose tags as drafts; the curator reviews every proposal before anything is published.

Rules:
- Use only the tag slugs listed below, per kind. Propose a tag only when the evidence supports it (images, bio, or an unambiguous handle/name such as "keramia" or "akvarell"). Empty lists are fine and expected when little is known.
- Region: one of the listed region slugs, from the city, bio or other explicit evidence. Budapest is its own region; "pest" is Pest county. Use "kulfold" for artists clearly based abroad, and "unknown" when there is no evidence. Do not guess from the language of the handle alone.
- newTags: only for clearly applicable media/techniques/subjects with no fitting slug in the vocabulary. Hungarian names, singular, capitalised like the existing ones.
- rationale: Hungarian, one or two sentences on what the proposal is based on.

Tag vocabulary (slug (name)):
${vocabulary}

Regions (slug (name)):
${REGIONS.map((r) => `  - ${r.value} (${r.label})`).join('\n')}`

const mediaStaticDir = path.resolve(
  (payload.collections.media.config.upload as { staticDir?: string }).staticDir || 'media',
)

/** Read an uploaded image (prefer the 1600px `large` size) as a base64 image block. */
async function imageBlock(media: Media): Promise<Anthropic.Beta.BetaImageBlockParam | undefined> {
  const variant = media.sizes?.large?.filename ? media.sizes.large : media
  const mimeType = variant.mimeType || media.mimeType
  if (!mimeType || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) return undefined
  let data: Buffer | undefined
  if (variant.filename) {
    data = await fs.readFile(path.join(mediaStaticDir, variant.filename)).catch(() => undefined)
  }
  // Remote storage (e.g. R2 in production): fetch through the public URL.
  if (!data && variant.url) {
    const res = await fetch(new URL(variant.url, serverURL()))
    if (res.ok) data = Buffer.from(await res.arrayBuffer())
  }
  if (!data) return undefined
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: data.toString('base64'),
    },
  }
}

async function buildContent(artist: Artist): Promise<{ content: Anthropic.Beta.BetaContentBlockParam[]; images: number }> {
  const works = await payload.find({
    collection: 'works',
    where: { and: [{ artist: { equals: artist.id } }, { source: { equals: 'upload' } }] },
    depth: 1,
    limit: MAX_IMAGES,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  const titles: string[] = []
  for (const work of works.docs) {
    if (!work.image || typeof work.image !== 'object') continue
    const block = await imageBlock(work.image)
    if (!block) continue
    content.push(block)
    titles.push([work.title, work.year].filter(Boolean).join(', ') || '(untitled)')
  }
  const known = {
    handle: artist.handle,
    instagram: `https://www.instagram.com/${artist.handle}/`,
    name: artist.name,
    bio: artist.bio || null,
    city: artist.city || null,
    website: artist.website || null,
    images: titles.length ? titles.map((t, i) => `image ${i + 1}: ${t}`) : 'none',
  }
  content.push({
    type: 'text',
    text: `Propose tags for this account.\n\n${JSON.stringify(known, null, 2)}`,
  })
  return { content, images: titles.length }
}

async function propose(artist: Artist): Promise<{ proposal: Proposal; images: number }> {
  const { content, images } = await buildContent(artist)
  const response = await anthropic.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // Server-side fallback when a safety classifier declines (Claude API only).
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(ResponseSchema) },
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  })
  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined (${response.stop_details?.category ?? 'no category'})`)
  }
  if (response.stop_reason === 'max_tokens') throw new Error('response hit max_tokens')
  if (!response.parsed_output) throw new Error('no parseable structured output')
  return { proposal: sanitize(response.parsed_output), images }
}

// ---------------------------------------------------------------- writing

const idsOf = (rel: Artist['medium']): number[] =>
  (rel ?? []).map((t) => (typeof t === 'object' ? t.id : t))

/** Resolve or (with --create-tags) create a tag for a proposed new name. */
async function ensureTag(kind: Kind, name: string, payload: Payload): Promise<Tag | string> {
  const slug = slugify(name)
  if (!slug) return `"${name}": empty slug`
  const existing = tagBySlug.get(slug)
  if (existing) return existing.kind === kind ? existing : `"${name}": slug "${slug}" is already a ${existing.kind} tag`
  const tag = await payload.create({ collection: 'tags', data: { name, kind, slug }, overrideAccess: true })
  tagBySlug.set(slug, tag)
  allTags.push(tag)
  return tag
}

function notesBlock(p: Proposal, newTagNote: string[]): string {
  const names = (slugs: string[]) => slugs.map((s) => tagBySlug.get(s)?.name ?? s).join(', ') || '-'
  const artistHu = { yes: 'igen', no: 'nem', unclear: 'bizonytalan' }[p.likelyArtist]
  const confHu = { low: 'alacsony', medium: 'közepes', high: 'magas' }[p.confidence]
  const date = new Date().toISOString().slice(0, 10)
  return [
    `${NOTES_START} (${date}, ${MODEL}) ---`,
    `Művész? ${artistHu} · bizonyosság: ${confHu}`,
    `Médium: ${names(p.medium)} · Technika: ${names(p.technique)} · Téma: ${names(p.subject)}`,
    `Régió: ${REGIONS.find((r) => r.value === p.region)?.label ?? 'ismeretlen'}`,
    ...newTagNote,
    `Indoklás: ${p.rationale}`,
    NOTES_END,
  ].join('\n')
}

/** Replace a previous AI block in the notes, keeping the curator's own text. */
function mergeNotes(existing: string | null | undefined, block: string): string {
  const notes = existing ?? ''
  const start = notes.indexOf(NOTES_START)
  const end = notes.indexOf(NOTES_END)
  const kept =
    start >= 0 && end > start ? notes.slice(0, start) + notes.slice(end + NOTES_END.length) : notes
  return [kept.trim(), block].filter(Boolean).join('\n\n')
}

// ---------------------------------------------------------------- main

console.error(
  `Tagging ${artists.length} artist(s) with ${MODEL}${dryRun ? ' (dry run, nothing written)' : ''}...`,
)

const report: unknown[] = []
let written = 0
let failures = 0

for (const artist of artists) {
  let result
  try {
    result = await propose(artist)
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error(`Anthropic API rejected the credentials: ${err.message}`)
      process.exit(1)
    }
    failures++
    const message = err instanceof Anthropic.APIError ? `API error ${err.status}: ${err.message}` : (err as Error).message
    console.error(`  ${artist.handle}: ${message}`)
    report.push({ handle: artist.handle, error: message })
    continue
  }
  const { proposal, images } = result

  // Unknown tags: list them, or create them with --create-tags.
  const newTagNote: string[] = []
  const created: Record<Kind, string[]> = { medium: [], technique: [], subject: [] }
  if (proposal.newTags.length) {
    if (createTags && !dryRun) {
      const problems: string[] = []
      for (const { kind, name } of proposal.newTags) {
        const tag = await ensureTag(kind, name, payload)
        if (typeof tag === 'string') problems.push(tag)
        else created[kind].push(tag.slug)
      }
      newTagNote.push(`Új címkék létrehozva: ${proposal.newTags.map((t) => `${t.name} (${KIND_HU[t.kind]})`).join(', ')}`)
      if (problems.length) newTagNote.push(`Nem létrehozható: ${problems.join('; ')}`)
    } else {
      newTagNote.push(
        `Hiányzó címke-javaslatok (nincsenek létrehozva): ${proposal.newTags.map((t) => `${t.name} (${KIND_HU[t.kind]})`).join(', ')}`,
      )
    }
  }

  const medium = [...proposal.medium, ...created.medium]
  const technique = [...proposal.technique, ...created.technique]
  const ids = (slugs: string[]) => slugs.map((s) => tagBySlug.get(s)?.id).filter((id): id is number => id !== undefined)

  const data: Partial<Artist> = {}
  if (medium.length && (force || idsOf(artist.medium).length === 0)) data.medium = ids(medium)
  if (technique.length && (force || idsOf(artist.technique).length === 0)) data.technique = ids(technique)
  if (proposal.region !== 'unknown' && (force || !artist.region)) data.region = proposal.region as Artist['region']
  const tagFieldsWritten = Object.keys(data)
  if (tagFieldsWritten.length) data.aiTagged = true
  data.curatorNotes = mergeNotes(artist.curatorNotes, notesBlock(proposal, newTagNote))

  report.push({
    handle: artist.handle,
    imagesSent: images,
    proposal,
    // Fields that would be (or were) written; others are kept as the curator set them.
    writes: tagFieldsWritten,
  })

  if (!dryRun) {
    await payload.update({ collection: 'artists', id: artist.id, data, overrideAccess: true })
    written++
    console.error(`  ${artist.handle}: updated ${[...tagFieldsWritten, 'curatorNotes'].join(', ')}`)
  }
}

console.log(JSON.stringify(report, null, 2))
console.error(
  `Done: ${artists.length - failures} proposed, ${dryRun ? 0 : written} updated, ${failures} failed.`,
)
process.exit(failures ? 1 : 0)
