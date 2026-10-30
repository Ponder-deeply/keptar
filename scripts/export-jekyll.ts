// Export the public part of Képtár as a static Jekyll site for GitHub Pages.
//
//   pnpm export:jekyll (--live-url <url> | --contact-email <email>)
//                      [--out <dir>] [--baseurl </repo>] [--site-url <url>]
//
// Reads through the Local API with `overrideAccess: false` and no user, so the
// export holds exactly what an anonymous visitor sees: published artists, their
// works, venues, and exhibitions with their published artists. Staff-only
// fields (email, claimedBy, curatorNotes, aiTagged) never reach the output.
//
// Output (default `jekyll-site/`): the template from `scripts/jekyll-template/`,
// plus `_config.yml`, `_artists/<handle>.html`, `_data/*.json` and the uploaded
// images under `assets/media/`. Push it to a GitHub repo and enable Pages
// ("Deploy from a branch"); GitHub builds it with Jekyll, no plugins needed.
// `--out` can be a clone of that repo: everything except `.git` and `CNAME` is
// replaced on each run. A non-empty directory is only wiped if it holds the
// `.keptar-export` marker written by an earlier run.
//
// The static copy has no login, swipe, saved list or forms. Each profile still
// needs the opt-out link ("Ez az én profilom / távolítsd el") and the inquiry
// link: they point to the live site (`--live-url`), or else to a mailto
// (`--contact-email`). One of the two is required.
//
// Exhibitions are split into current / upcoming at export time, so re-run the
// export (e.g. nightly) to keep that page fresh.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPayload, type Payload } from 'payload'

import config from '../src/payload.config'
import { asArtist, asMedia, externalUrl, formatDateRange, regionLabel, tagNames } from '../src/components/format'
import { parseIgPermalink } from '../src/components/igPermalink'
import type { Media, Venue, Work } from '../src/payload-types'
import { isValidEmail } from '../src/lib/validation'
import { parseArgs } from './lib/args'

const USAGE =
  'Usage: pnpm export:jekyll (--live-url <url> | --contact-email <email>) [--out <dir>] [--baseurl </repo>] [--site-url <url>]'
const TEMPLATE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'jekyll-template')
const MARKER = '.keptar-export'
const KEEP = new Set(['.git', 'CNAME', MARKER])
const MEDIA_DIR = path.resolve(process.cwd(), 'media')

const VENUE_TYPES: Record<Venue['type'], string> = {
  gallery: 'Galéria',
  museum: 'Múzeum',
  studio: 'Műterem',
  'cultural-centre': 'Kulturális központ',
  other: 'Egyéb',
}

// ---------------------------------------------------------------- arguments

let args
try {
  args = parseArgs(process.argv.slice(2), ['out', 'baseurl', 'site-url', 'live-url', 'contact-email'])
} catch (err) {
  console.error((err as Error).message)
  console.error(USAGE)
  process.exit(1)
}
if (args.flags.size > 0 || args.positional.length > 0) {
  console.error(`Unknown argument: ${[...args.flags].map((f) => `--${f}`).concat(args.positional).join(' ')}`)
  console.error(USAGE)
  process.exit(1)
}

const outDir = path.resolve(args.values.get('out') ?? 'jekyll-site')
const baseurl = (args.values.get('baseurl') ?? '').replace(/\/$/, '')
const siteUrl = args.values.get('site-url') ? externalUrl(args.values.get('site-url'))?.replace(/\/$/, '') : ''
const liveUrl = args.values.get('live-url') ? externalUrl(args.values.get('live-url'))?.replace(/\/$/, '') : ''
const contactEmail = args.values.get('contact-email') ?? ''

if (baseurl && !/^\/[A-Za-z0-9._/-]+$/.test(baseurl)) {
  console.error('--baseurl must look like /repo-name')
  process.exit(1)
}
if (siteUrl === undefined || liveUrl === undefined) {
  console.error('--site-url and --live-url must be http(s) URLs')
  process.exit(1)
}
if (contactEmail && !isValidEmail(contactEmail)) {
  console.error('--contact-email is not a valid email address')
  process.exit(1)
}
if (!liveUrl && !contactEmail) {
  console.error('Every profile needs an opt-out and inquiry link: pass --live-url or --contact-email.')
  console.error(USAGE)
  process.exit(1)
}

// ---------------------------------------------------------------- output dir

async function prepareOutDir(dir: string): Promise<void> {
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
    return
  }
  const foreign = entries.filter((e) => !KEEP.has(e))
  if (foreign.length > 0 && !entries.includes(MARKER)) {
    throw new Error(`${dir} is not empty and has no ${MARKER} marker; refusing to overwrite it.`)
  }
  await Promise.all(foreign.map((e) => fs.rm(path.join(dir, e), { recursive: true, force: true })))
}

const writeJson = (file: string, data: unknown) =>
  fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, JSON.stringify(data, null, 2) + '\n'))

// ---------------------------------------------------------------- media

type ExportedImage = { src: string; width: number; height: number; alt: string }

/** Copies the uploaded image (one size variant, else the original) into assets/media. */
async function exportImage(media: Media | undefined, size: 'thumb' | 'large', copied: Set<string>) {
  if (!media) return null
  const variant = media.sizes?.[size]
  const filename = (variant?.filename && variant.filename) || media.filename
  const width = (variant?.filename && variant.width) || media.width
  const height = (variant?.filename && variant.height) || media.height
  // Filenames come from Payload's upload handling; still refuse anything path-like.
  if (!filename || !width || !height || filename !== path.basename(filename)) return null

  if (!copied.has(filename)) {
    const target = path.join(outDir, 'assets', 'media', filename)
    await fs.mkdir(path.dirname(target), { recursive: true })
    try {
      await fs.copyFile(path.join(MEDIA_DIR, filename), target)
    } catch {
      console.warn(`  missing media file ${filename}, skipped`)
      return null
    }
    copied.add(filename)
  }
  return { src: `/assets/media/${filename}`, width, height, alt: media.alt ?? '' } satisfies ExportedImage
}

// ---------------------------------------------------------------- export

async function exportSite(payload: Payload) {
  const publicRead = { overrideAccess: false, pagination: false, depth: 1 } as const
  const copied = new Set<string>()
  const now = new Date()

  const { docs: artists } = await payload.find({ collection: 'artists', ...publicRead, depth: 1 })
  const { docs: works } = await payload.find({ collection: 'works', ...publicRead, sort: '-createdAt' })
  const { docs: venues } = await payload.find({ collection: 'venues', ...publicRead, sort: 'name' })
  const { docs: exhibitions } = await payload.find({ collection: 'exhibitions', ...publicRead, sort: 'startDate' })

  const worksByArtist = new Map<number, Work[]>()
  for (const work of works) {
    const id = typeof work.artist === 'object' ? work.artist.id : work.artist
    worksByArtist.set(id, [...(worksByArtist.get(id) ?? []), work])
  }

  // Liquid's `sort` is bytewise, so the Hungarian name order is precomputed.
  const sorted = [...artists].sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  const mediums = new Set<string>()

  for (const [order, artist] of sorted.entries()) {
    const own = worksByArtist.get(artist.id) ?? []
    const exportedWorks = []
    let cover: ExportedImage | null = null
    for (const work of own) {
      const image = work.source === 'upload' ? await exportImage(asMedia(work.image), 'large', copied) : null
      const ig = work.source === 'instagram' ? parseIgPermalink(work.igUrl) : null
      if (!image && !ig) continue
      if (image && !cover) cover = await exportImage(asMedia(work.image), 'thumb', copied)
      exportedWorks.push({
        title: work.title || (ig ? 'Instagram-poszt' : 'Cím nélkül'),
        year: work.year ?? null,
        dimensions: work.dimensions ?? null,
        ig,
        image,
      })
    }

    const medium = tagNames(artist.medium)
    medium.forEach((m) => mediums.add(m))
    const region = regionLabel(artist.region) ?? null
    // JSON is valid YAML, which keeps front matter safe whatever the bio contains.
    const frontMatter = {
      layout: 'artist',
      // Explicit, because Jekyll skips files whose name starts with "_" (a valid handle).
      permalink: `/muveszek/${artist.handle}/`,
      title: artist.name,
      name: artist.name,
      handle: artist.handle,
      order,
      bio: artist.bio ?? null,
      medium,
      technique: tagNames(artist.technique),
      region,
      city: artist.city ?? null,
      // "Budapest, Budapest" reads oddly, as on the live directory.
      place: [...new Set([artist.city, region].filter(Boolean))].join(', '),
      website: externalUrl(artist.website) ?? null,
      cover,
      works: exportedWorks,
    }
    const file = path.join(outDir, '_artists', `artist-${artist.handle}.html`)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, `---\n${JSON.stringify(frontMatter, null, 2)}\n---\n`)
  }

  const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest' })
  const today = dayFormat.format(now)
  const exportedExhibitions = []
  for (const e of exhibitions) {
    const end = dayFormat.format(new Date(e.endDate ?? e.startDate))
    if (end < today) continue
    const venue = typeof e.venue === 'object' ? e.venue : undefined
    exportedExhibitions.push({
      title: e.title,
      when: dayFormat.format(new Date(e.startDate)) <= today ? 'current' : 'upcoming',
      date: formatDateRange(e.startDate, e.endDate),
      start: e.startDate,
      venue: venue ? [venue.name, venue.city, venue.address].filter(Boolean).join(', ') : null,
      // Unpublished artists come back unpopulated (access rules), so they are skipped.
      artists: (e.artists ?? []).flatMap((a) => {
        const artist = asArtist(a)
        return artist?.status === 'published' ? [{ name: artist.name, handle: artist.handle }] : []
      }),
      description: e.description ?? null,
      url: externalUrl(e.url) ?? null,
      image: await exportImage(asMedia(e.image), 'large', copied),
    })
  }

  await writeJson(path.join(outDir, '_data', 'exhibitions.json'), exportedExhibitions)
  await writeJson(
    path.join(outDir, '_data', 'venues.json'),
    venues.map((v) => ({
      name: v.name,
      type: VENUE_TYPES[v.type],
      address: [v.address, v.city].filter(Boolean).join(', '),
      website: externalUrl(v.website) ?? null,
      map: `https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lng}#map=17/${v.lat}/${v.lng}`,
    })),
  )
  await writeJson(path.join(outDir, '_data', 'filters.json'), {
    medium: [...mediums].sort((a, b) => a.localeCompare(b, 'hu')),
    region: [...new Set(sorted.map((a) => regionLabel(a.region)).filter(Boolean))].sort((a, b) =>
      a!.localeCompare(b!, 'hu'),
    ),
  })

  return { artists: sorted, works: works.length, exhibitions: exportedExhibitions.length, venues, copied }
}

/** `_config.yml`, as JSON (valid YAML), so values need no escaping. */
const siteConfig = (exportedAt: string) => ({
  title: 'Képtár',
  description: 'Kortárs magyar képzőművészek bemutató oldala.',
  lang: 'hu',
  url: siteUrl,
  baseurl,
  live_url: liveUrl,
  contact_email: contactEmail,
  exported_at: exportedAt,
  collections: { artists: { output: true } },
  exclude: ['README.md', 'Gemfile', 'Gemfile.lock', 'vendor', MARKER],
})

async function main() {
  await prepareOutDir(outDir)
  await fs.cp(TEMPLATE_DIR, outDir, { recursive: true })
  await fs.copyFile(path.resolve('src/app/(site)/styles.css'), path.join(outDir, 'assets', 'css', 'site.css'))

  const payload = await getPayload({ config })
  const result = await exportSite(payload)
  const exportedAt = new Intl.DateTimeFormat('hu-HU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Budapest',
  }).format(new Date())

  await fs.writeFile(path.join(outDir, '_config.yml'), JSON.stringify(siteConfig(exportedAt), null, 2) + '\n')
  await fs.writeFile(path.join(outDir, MARKER), 'Generated by `pnpm export:jekyll` in the Képtár repo.\n')

  console.log(
    `Exported ${result.artists.length} artists, ${result.works} works, ${result.exhibitions} current/upcoming exhibitions, ` +
      `${result.venues.length} venues and ${result.copied.size} image files to ${outDir}`,
  )
  process.exit(0)
}

// Top-level await: `payload run` exits as soon as the module has been evaluated.
try {
  await main()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
