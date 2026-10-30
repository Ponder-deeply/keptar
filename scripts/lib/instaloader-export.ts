// Reader and parser for an instaloader download (https://github.com/instaloader/instaloader):
// one directory per profile, holding instaloader's metadata JSON files. No Payload
// imports, so it can be unit tested directly.
//
// Run instaloader metadata-only, e.g.
//   instaloader --no-pictures --no-videos --no-video-thumbnails --no-profile-pic \
//     --no-captions --no-compress-json --dirname-pattern 'export/{profile}' <handle>…
//
// Every metadata file is {"node": {...}, "instaloader": {"node_type": "Profile" | "Post" | …}}.
// A Profile node carries username, full_name, biography, external_url, is_private;
// a Post node carries shortcode (or code) and taken_at_timestamp (or date).
// Files are .json, or .json.xz without --no-compress-json (needs the `xz` binary).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { IG_POST_URL_RE, parseIgPermalink } from '../../src/components/igPermalink'
import { isValidHandle, normalizeHandle } from '../../src/lib/validation'
import type { InscrapeResult } from './inscrape-export'
import type { IgPost, IgProfile } from './instagram-graph'

export type InstaloaderDir = {
  /** Directory name, used in error messages. */
  name: string
  /** Parsed metadata files of the directory. */
  structures: unknown[]
  /** Metadata files that could not be read or parsed. */
  unreadable: string[]
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

const SHORTCODE_RE = /^[A-Za-z0-9_-]+$/

/** The node of an instaloader structure of the given type, if `s` is one. */
function nodeOf(s: unknown, type: string): Record<string, unknown> | undefined {
  if (!isRecord(s) || !isRecord(s.instaloader) || s.instaloader.node_type !== type) return undefined
  return isRecord(s.node) ? s.node : undefined
}

async function readStructure(file: string): Promise<unknown> {
  const raw = file.endsWith('.xz')
    ? execFileSync('xz', ['-dc', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    : await fs.readFile(file, 'utf8')
  return JSON.parse(raw)
}

async function readDir(dir: string): Promise<InstaloaderDir> {
  const result: InstaloaderDir = { name: path.basename(dir), structures: [], unreadable: [] }
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    // Skips instaloader's *_comments.json too: they are bare arrays, ignored by the parser anyway.
    if (!entry.isFile() || !/\.json(\.xz)?$/.test(entry.name)) continue
    try {
      result.structures.push(await readStructure(path.join(dir, entry.name)))
    } catch {
      result.unreadable.push(entry.name)
    }
  }
  return result
}

/**
 * Reads an instaloader download: either one profile directory, or a directory
 * of profile directories (instaloader's default layout). Hidden directories
 * are skipped.
 */
export async function readInstaloaderExport(root: string): Promise<InstaloaderDir[]> {
  const top = await readDir(root)
  if (top.structures.some((s) => nodeOf(s, 'Profile'))) return [top]
  const dirs: InstaloaderDir[] = []
  const entries = (await fs.readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) dirs.push(await readDir(path.join(root, entry.name)))
  return dirs
}

export function parseInstaloaderExport(dirs: InstaloaderDir[]): InscrapeResult {
  const seen = new Set<string>()
  const result: InscrapeResult = { accounts: [], duplicates: [], invalid: [] }

  dirs.forEach(({ name, structures, unreadable }, index) => {
    for (const file of unreadable) result.invalid.push({ index, reason: `${name}/${file}: unreadable JSON` })

    const profileNode = structures.map((s) => nodeOf(s, 'Profile')).find(Boolean)
    if (!profileNode || typeof profileNode.username !== 'string') {
      result.invalid.push({ index, reason: `${name}: no profile metadata (was --no-metadata-json used?)` })
      return
    }
    const handle = normalizeHandle(profileNode.username)
    if (!isValidHandle(handle)) {
      result.invalid.push({ index, reason: `${name}: not a valid Instagram handle: "${profileNode.username}"` })
      return
    }
    if (seen.has(handle)) {
      result.duplicates.push(handle)
      return
    }
    seen.add(handle)

    const byUrl = new Map<string, IgPost>()
    let skipped = 0
    for (const s of structures) {
      const node = nodeOf(s, 'Post')
      if (!node) continue
      const shortcode = text(node.shortcode) ?? text(node.code)
      const url = shortcode && SHORTCODE_RE.test(shortcode) ? parseIgPermalink(`https://www.instagram.com/p/${shortcode}/`) : null
      if (!url || !IG_POST_URL_RE.test(url)) {
        skipped++
        continue
      }
      const ts = typeof node.date === 'number' ? node.date : node.taken_at_timestamp
      const postedAt = typeof ts === 'number' ? new Date(ts * 1000) : undefined
      if (!byUrl.has(url)) byUrl.set(url, { url, postedAt })
    }
    // Newest first, like the other sources; posts without a date go last.
    const posts = [...byUrl.values()].sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))

    const profile: IgProfile = {
      name: text(profileNode.full_name),
      biography: text(profileNode.biography),
      website: text(profileNode.external_url),
      posts,
      skipped,
    }
    const status = posts.length ? 'ok' : profileNode.is_private === true ? 'private' : 'no_posts_found'
    result.accounts.push({ handle, status, profile })
  })

  return result
}
