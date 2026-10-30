// Download the profiles of Dimitrij's following list with instaloader, in
// sections run one after another with a pause between them, so Instagram sees
// a few small bursts instead of one long scrape (see docs/INSTAGRAM.md).
//
//   pnpm instaloader:batches <following.json> --sections <n> --delay <30m> [--login <user>]
//     [--out ig-export] [--start <k>] [--instaloader <path>] [--dry-run]
//
// Handles are split in file order into n near-equal sections. Each section is
// one instaloader run (metadata only, into <out>/{profile}).
// instaloader's exit code 1 (some profiles failed, e.g. renamed) continues;
// anything else (login failure, checkpoint, Ctrl-C) stops and prints the
// --start value to resume from. Rerunning a section is cheap:
// <out>/latest-stamps.ini records each profile's newest post, and only newer
// posts are fetched.
//
// Then: pnpm import:instagram <out> --update-posts
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { parseArgs } from './lib/args'
import { formatDuration, parseDuration, splitIntoSections } from './lib/batches'
import { parseFollowingExport } from './lib/instagram-export'

const USAGE =
  'Usage: pnpm instaloader:batches <following.json> --sections <n> --delay <30m> [--login <user>] ' +
  '[--out ig-export] [--start <k>] [--instaloader <path>] [--dry-run]'
const VALUES = ['sections', 'delay', 'login', 'out', 'start', 'instaloader']
const FLAGS = ['dry-run']

function fail(message: string): never {
  console.error(message)
  console.error(USAGE)
  process.exit(1)
}

let args: ReturnType<typeof parseArgs>
try {
  args = parseArgs(process.argv.slice(2), VALUES)
} catch (err) {
  fail((err as Error).message)
}
const unknown = [...args.flags].filter((f) => !FLAGS.includes(f))
if (unknown.length) fail(`Unknown flag(s): ${unknown.map((f) => `--${f}`).join(' ')}`)
const file = args.positional[0]
if (!file || args.positional.length > 1) fail('Give exactly one following.json.')

const sectionCount = Number(args.values.get('sections'))
if (!Number.isInteger(sectionCount) || sectionCount < 1) fail('--sections must be a positive integer.')
let delayMs: number
try {
  delayMs = parseDuration(args.values.get('delay') ?? fail('--delay is required (e.g. 30m).'))
} catch (err) {
  fail((err as Error).message)
}
const start = Number(args.values.get('start') ?? 1)
const out = args.values.get('out') ?? 'ig-export'
const login = args.values.get('login')
const bin = args.values.get('instaloader') ?? 'instaloader'
const dryRun = args.flags.has('dry-run')

let handles: string[]
try {
  const parsed = parseFollowingExport(JSON.parse(await fs.readFile(file, 'utf8')))
  handles = parsed.accounts.map((a) => a.handle)
  if (parsed.invalid.length) console.log(`Skipping ${parsed.invalid.length} invalid entries of ${file}.`)
} catch (err) {
  console.error(`Cannot read ${file}: ${(err as Error).message}`)
  process.exit(1)
}
if (!handles.length) {
  console.error(`No handles in ${file}.`)
  process.exit(1)
}

const sections = splitIntoSections(handles, sectionCount)
if (!Number.isInteger(start) || start < 1 || start > sections.length) {
  fail(`--start must be between 1 and ${sections.length}.`)
}

const instaloaderArgs = (section: string[]) => [
  ...(login ? ['--login', login] : []),
  '--no-pictures',
  '--no-videos',
  '--no-video-thumbnails',
  '--no-profile-pic',
  '--no-captions',
  '--no-compress-json',
  // Resume support. --fast-update would be the usual choice, but instaloader
  // refuses it together with --no-pictures.
  '--latest-stamps',
  path.join(out, 'latest-stamps.ini'),
  '--dirname-pattern',
  `${out}/{profile}`,
  '--',
  ...section,
]

/** Runs instaloader on one section; resolves with its exit code. */
const run = (section: string[]) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(bin, instaloaderArgs(section), { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 130 : 1)))
  })

// Without a saved session instaloader prompts for the password in every
// section, and a failed prompt exits with 1, which looks like a non-fatal error.
if (login && !dryRun) {
  const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  const session = path.join(configDir, 'instaloader', `session-${login}`)
  try {
    await fs.access(session)
  } catch {
    console.error(`No instaloader session for ${login} (${session}). Log in once first: ${bin} --login ${login}`)
    process.exit(1)
  }
}

console.log(
  `${handles.length} handles in ${sections.length} sections ` +
    `(${sections.map((s) => s.length).join(', ')}), ${formatDuration(delayMs)} apart, into ${out}/`,
)
if (!login) console.log('No --login: Instagram blocks most anonymous runs (docs/INSTAGRAM.md).')

for (let i = start - 1; i < sections.length; i++) {
  const label = `Section ${i + 1}/${sections.length}`
  if (dryRun) {
    console.log(`\n${label}: ${bin} ${instaloaderArgs(sections[i]).join(' ')}`)
    continue
  }
  console.log(`\n${label} (${sections[i].length} profiles), ${new Date().toLocaleTimeString('hu-HU')}`)
  let code: number
  try {
    code = await run(sections[i])
  } catch (err) {
    console.error(`Cannot start ${bin}: ${(err as Error).message} (install it, or pass --instaloader <path>).`)
    process.exit(1)
  }
  // 0: success; 1: non-fatal errors (some profiles missing or private). Anything else is fatal.
  if (code > 1) {
    console.error(`\n${label}: instaloader exited with ${code}; stopping.`)
    console.error(`Resume later with --start ${i + 1}.`)
    process.exit(code)
  }
  if (i < sections.length - 1) {
    const at = new Date(Date.now() + delayMs).toLocaleTimeString('hu-HU')
    console.log(`${label} done${code ? ' (some profiles failed)' : ''}. Next section at ${at}.`)
    await sleep(delayMs)
  }
}

if (!dryRun) console.log(`\nAll sections done. Next: pnpm import:instagram ${out} --dry-run`)
