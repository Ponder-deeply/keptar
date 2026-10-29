import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { en } from '@payloadcms/translations/languages/en'
import { hu } from '@payloadcms/translations/languages/hu'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { isStaff } from './access/roles'
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
const email = process.env.RESEND_API_KEY
  ? resendAdapter({
      apiKey: process.env.RESEND_API_KEY,
      defaultFromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@keptar.hu',
      defaultFromName: 'Képtár',
    })
  : consoleEmailAdapter

export default buildConfig({
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
