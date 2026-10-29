// Turn a short-lived Graph API Explorer token into the INSTAGRAM_* values the
// importer needs, and check that Business Discovery works with them.
//
//   pnpm instagram:token <short-lived-user-token> [--write]
//
// Needs META_APP_ID and META_APP_SECRET. Prints INSTAGRAM_USER_ID and a
// long-lived INSTAGRAM_ACCESS_TOKEN (about 60 days; rerun to renew).
// --write  also stores both in ./.env instead of only printing them.
// Step-by-step Meta setup: docs/INSTAGRAM.md.
import fs from 'node:fs/promises'

import { parseArgs } from './lib/args'
import { fetchProfile, setupAccess } from './lib/instagram-graph'

const USAGE = 'Usage: pnpm instagram:token <short-lived-user-token> [--write]'

const args = parseArgs(process.argv.slice(2))
const shortToken = args.positional[0]
const write = args.flags.has('write')
const unknown = [...args.flags].filter((f) => f !== 'write')
if (!shortToken || unknown.length || args.positional.length > 1) {
  console.error(unknown.length ? `Unknown flag(s): ${unknown.map((f) => `--${f}`).join(' ')}\n${USAGE}` : USAGE)
  process.exit(1)
}

const appId = process.env.META_APP_ID
const appSecret = process.env.META_APP_SECRET
if (!appId || !appSecret) {
  console.error('Set META_APP_ID and META_APP_SECRET in .env (Meta app → App settings → Basic).')
  process.exit(1)
}
const version = process.env.INSTAGRAM_GRAPH_VERSION || undefined

let setup
try {
  setup = await setupAccess(shortToken, { appId, appSecret, version })
} catch (err) {
  console.error(`Token exchange failed: ${(err as Error).message}`)
  process.exit(1)
}

if (setup.missingPermissions.length) {
  console.error(
    `The token lacks: ${setup.missingPermissions.join(', ')}.\n` +
      'Add them in the Graph API Explorer, click "Generate Access Token" again and rerun.',
  )
  process.exit(1)
}
if (!setup.accounts.length) {
  console.error(
    'No Instagram professional account is linked to a Facebook Page this token can see.\n' +
      'Switch the Instagram account to Business/Creator, link it to a Page, and when\n' +
      'generating the token select that Page (and the Instagram account) in the dialog.',
  )
  process.exit(1)
}
if (setup.accounts.length > 1) {
  console.log('Several Instagram accounts found; using the first:')
  for (const a of setup.accounts) console.log(`  ${a.igUserId}  @${a.username}  (Page: ${a.pageName})`)
}
const account = setup.accounts[0]

// Smoke test: Business Discovery on our own account.
if (account.username) {
  try {
    const own = await fetchProfile(account.username, {
      accessToken: setup.accessToken,
      igUserId: account.igUserId,
      version,
    })
    console.log(`Business Discovery OK: @${account.username} has ${own?.posts.length ?? 0} posts visible.`)
  } catch (err) {
    console.error(`Business Discovery test failed: ${(err as Error).message}`)
    process.exit(1)
  }
}

const values = { INSTAGRAM_USER_ID: account.igUserId, INSTAGRAM_ACCESS_TOKEN: setup.accessToken }
const expires = setup.expiresAt ? setup.expiresAt.toISOString().slice(0, 10) : 'unknown'

if (write) {
  let env = ''
  try {
    env = await fs.readFile('.env', 'utf8')
  } catch {
    // No .env yet: create one.
  }
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`
    const re = new RegExp(`^${key}=.*$`, 'm')
    env = re.test(env) ? env.replace(re, () => line) : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n`
  }
  await fs.writeFile('.env', env)
  console.log(`Wrote INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN to .env (token expires ${expires}).`)
} else {
  console.log(`\nAdd to .env (token expires ${expires}):\n`)
  for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`)
}
