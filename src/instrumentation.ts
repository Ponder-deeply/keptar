// Runs once when the Next.js server starts.
export async function register() {
  // Payload only starts the job crons (the nightly inquiry purge) when getPayload is
  // called with `cron: true`. Public pages don't pass it, so without this the purge
  // would wait for the first /api or /admin request after each restart.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
  await getPayload({ config, cron: true })
}
