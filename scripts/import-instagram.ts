// Import Dimitrij's Instagram following list as pending artists.
//
//   pnpm import:instagram <path/to/following.json> [--dry-run]
//
// One `artists` record per followed account: status "pending", name = handle.
// Idempotent: handles already in the database are skipped and never touched,
// because the curator may have edited them.
import fs from 'node:fs/promises'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { parseArgs } from './lib/args'
import { parseFollowingExport } from './lib/instagram-export'

const USAGE = 'Usage: pnpm import:instagram <path/to/following.json> [--dry-run]'

const args = parseArgs(process.argv.slice(2))
const file = args.positional[0]
const dryRun = args.flags.has('dry-run')
const unknown = [...args.flags].filter((f) => f !== 'dry-run')
if (!file || unknown.length || args.positional.length > 1) {
  console.error(unknown.length ? `Unknown flag(s): ${unknown.map((f) => `--${f}`).join(' ')}` : USAGE)
  if (unknown.length) console.error(USAGE)
  process.exit(1)
}

let parsed
try {
  parsed = parseFollowingExport(JSON.parse(await fs.readFile(file, 'utf8')))
} catch (err) {
  console.error(`Cannot read ${file}: ${(err as Error).message}`)
  process.exit(1)
}

const payload = await getPayload({ config })

const existing = new Set(
  (
    await payload.find({
      collection: 'artists',
      where: { handle: { in: parsed.accounts.map((a) => a.handle) } },
      pagination: false,
      depth: 0,
      select: { handle: true },
      overrideAccess: true,
    })
  ).docs.map((d) => d.handle),
)

const created: string[] = []
const skippedExisting: string[] = []
const failed: { handle: string; error: string }[] = []

for (const { handle } of parsed.accounts) {
  if (existing.has(handle)) {
    skippedExisting.push(handle)
    continue
  }
  if (dryRun) {
    created.push(handle)
    continue
  }
  try {
    await payload.create({
      collection: 'artists',
      data: { handle, name: handle, status: 'pending' },
      overrideAccess: true,
    })
    created.push(handle)
  } catch (err) {
    failed.push({ handle, error: (err as Error).message })
  }
}

const verb = dryRun ? 'would create' : 'created'
console.log(`\nInstagram import${dryRun ? ' (dry run, nothing written)' : ''}: ${file}`)
console.log(`  ${verb}:  ${created.length}${created.length ? `  (${created.join(', ')})` : ''}`)
console.log(
  `  skipped:  ${skippedExisting.length + parsed.duplicates.length}` +
    `  (${skippedExisting.length} already in DB, ${parsed.duplicates.length} duplicate in file)`,
)
console.log(`  invalid:  ${parsed.invalid.length}`)
for (const { index, reason } of parsed.invalid) console.log(`    #${index}: ${reason}`)
if (failed.length) {
  console.log(`  failed:   ${failed.length}`)
  for (const { handle, error } of failed) console.log(`    ${handle}: ${error}`)
}

process.exit(failed.length ? 1 : 0)
