/**
 * Public base URL of the site, without a trailing slash. Read at runtime from the
 * server-only SERVER_URL (a NEXT_PUBLIC_* variable would be frozen in at build time).
 */
export const serverURL = (): string =>
  (process.env.SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')
