import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { hu } from '@payloadcms/translations/languages/hu'
import path from 'path'
import { buildConfig, type SanitizedConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { isStaff, staffOnly } from './access/roles'
import { Artists } from './collections/Artists'
import { Exhibitions } from './collections/Exhibitions'
import { Inquiries } from './collections/Inquiries'
import { Media } from './collections/Media'
import { ProfileRequests } from './collections/ProfileRequests'
import { Swipes } from './collections/Swipes'
import { Tags } from './collections/Tags'
import { Users } from './collections/Users'
import { Venues } from './collections/Venues'
import { Works } from './collections/Works'
import { purgeInquiries } from './jobs/purge-inquiries'
import { consoleEmailAdapter } from './lib/consoleEmail'
import { serverURL } from './lib/serverURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseURL = process.env.DATABASE_URL || 'file:./keptar.db'

// SQLite locally (DATABASE_URL=file:...), Postgres in production (DATABASE_URL=postgres://...).
const db = /^postgres(ql)?:\/\//.test(databaseURL)
  ? postgresAdapter({
      pool: { connectionString: databaseURL },
      migrationDir: path.resolve(dirname, 'migrations'),
      push: false,
    })
  : sqliteAdapter({ client: { url: databaseURL } })

// Without RESEND_API_KEY, outgoing emails are printed to the server log (dev mode).
// In production that would put working login links in the logs, so refuse to start.
if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error('RESEND_API_KEY is required in production (otherwise magic links are written to the log).')
}
const email = process.env.RESEND_API_KEY
  ? resendAdapter({
      apiKey: process.env.RESEND_API_KEY,
      defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@keptar.hu',
      defaultFromName: 'Képtár',
    })
  : consoleEmailAdapter

const config = buildConfig({
  serverURL: serverURL(),
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: { titleSuffix: ' · Képtár' },
  },
  collections: [Artists, Works, Tags, Venues, Exhibitions, Inquiries, ProfileRequests, Swipes, Users, Media],
  editor: lexicalEditor(),
  i18n: {
    supportedLanguages: { hu, en },
    fallbackLanguage: 'hu',
  },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db,
  email,
  jobs: {
    access: {
      run: ({ req }) => isStaff(req.user),
      queue: ({ req }) => isStaff(req.user),
      cancel: ({ req }) => isStaff(req.user),
    },
    tasks: [purgeInquiries],
    autoRun: [{ cron: '0 * * * *', queue: 'nightly' }],
    // Only the long-running server processes jobs, not build or one-off scripts.
    shouldAutoRun: () => process.env.NEXT_PHASE !== 'phase-production-build',
  },
  sharp,
  plugins: [],
})

/**
 * Payload adds two internal entities whose default access is "any logged-in user",
 * and every visitor can become one through the magic link:
 * - `payload-jobs-stats` (added because a task has a `schedule`) stores when the
 *   purge last ran; writing a far-future date there would stop the purge for good.
 * - `payload-locked-documents` reveals which (possibly unpublished) documents staff
 *   have open, and lets anyone create or delete locks.
 * Both are only used by the admin and the job runner, so restrict them to staff.
 */
function restrictInternalEntities(sanitized: SanitizedConfig): SanitizedConfig {
  const stats = sanitized.globals.find((g) => g.slug === 'payload-jobs-stats')
  if (stats) stats.access = { ...stats.access, read: staffOnly, update: staffOnly, readVersions: staffOnly }
  const locks = sanitized.collections.find((c) => c.slug === 'payload-locked-documents')
  if (locks) {
    locks.access = { ...locks.access, create: staffOnly, read: staffOnly, update: staffOnly, delete: staffOnly }
  }
  return sanitized
}

export default config.then(restrictInternalEntities)
