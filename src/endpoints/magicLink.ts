import crypto from 'crypto'
import type { PayloadHandler, PayloadRequest } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

import { clientIp, createRateLimiter } from '../lib/rateLimit'
import { serverURL } from '../lib/serverURL'
import { escapeHtml, isValidEmail } from '../lib/validation'

// Passwordless login for visitors. Staff can still use the admin's password login.
//
//   POST /api/users/magic-link         { email, redirect? }  -> emails a one-time link
//   GET  /api/users/magic-link/verify  ?email&token&redirect -> page with a "Belépés" button
//   POST /api/users/magic-link/verify  email&token&redirect  -> uses up the token, sets the cookie
//
// The emailed GET link doesn't use up the token: mail security scanners (Outlook Safe
// Links, Proofpoint) open links before the user does, and would burn it.

const LINK_TTL_MS = 15 * 60 * 1000

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

// Each request emails a link (and may create a user), so throttle per IP and per address.
const allowIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 })
const allowEmail = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 })

/** Only allow paths on this site, to avoid an open redirect (`//x`, `/\x` etc. resolve off-site). */
export const safeRedirect = (value: unknown): string => {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  const base = new URL(serverURL())
  const url = new URL(value, base)
  // `/.//evil.com` keeps our origin here, but normalises to the path `//evil.com`,
  // which resolves off-site when it is used as a URL later.
  if (url.origin !== base.origin || url.pathname.startsWith('//')) return '/'
  return `${url.pathname}${url.search}${url.hash}`
}

export const requestMagicLink: PayloadHandler = async (req) => {
  const body = (await req.json?.().catch(() => null)) as { email?: unknown; redirect?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!isValidEmail(email)) {
    return Response.json({ error: 'Érvénytelen e-mail-cím.' }, { status: 400 })
  }

  if (!allowIp(clientIp(req.headers)) || !allowEmail(email)) {
    return Response.json({ error: 'Túl sok kérés. Próbáld újra később.' }, { status: 429 })
  }

  const { payload } = req
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
    req,
  })
  let user = existing.docs[0]
  if (!user) {
    try {
      user = await payload.create({
        collection: 'users',
        // The local strategy needs a password; nobody ever learns this one.
        data: { email, password: crypto.randomBytes(32).toString('hex'), role: 'user' },
        overrideAccess: true,
        req,
      })
    } catch (err) {
      // A parallel request (double submit) may have just created the same user.
      const again = await payload.find({
        collection: 'users',
        where: { email: { equals: email } },
        limit: 1,
        overrideAccess: true,
        req,
      })
      if (!again.docs[0]) throw err
      user = again.docs[0]
    }
  }

  const token = crypto.randomBytes(32).toString('base64url')
  await payload.db.updateOne({
    collection: 'users',
    id: user.id,
    data: {
      magicLinkHash: hashToken(token),
      magicLinkExpiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
    },
    req,
    returning: false,
  })

  const link = new URL('/api/users/magic-link/verify', serverURL())
  link.searchParams.set('email', email)
  link.searchParams.set('token', token)
  link.searchParams.set('redirect', safeRedirect(body?.redirect))

  await payload.sendEmail({
    to: email,
    subject: 'Belépés a Képtárba',
    text: `A belépéshez kattints erre a linkre (15 percig érvényes):\n\n${link.toString()}\n\nHa nem te kérted, hagyd figyelmen kívül ezt a levelet.`,
    html: `<p>A belépéshez kattints erre a linkre (15 percig érvényes):</p><p><a href="${link.toString()}">Belépés a Képtárba</a></p><p>Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p>`,
  })

  return Response.json({ ok: true })
}

type LinkUser = Record<string, unknown> & { id: number | string }

/** The user whose unexpired one-time token this is, or null. Doesn't use up the token. */
async function findLinkUser(req: PayloadRequest, email: string, token: string): Promise<LinkUser | null> {
  if (!email || !token) return null
  const user = await req.payload.db.findOne<LinkUser>({
    collection: 'users',
    where: { email: { equals: email } },
    req,
  })
  if (!user || typeof user.magicLinkHash !== 'string' || !user.magicLinkExpiresAt) return null
  const expected = Buffer.from(user.magicLinkHash, 'hex')
  const actual = Buffer.from(hashToken(token), 'hex')
  const valid =
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual) &&
    new Date(user.magicLinkExpiresAt as string).getTime() > Date.now()
  return valid ? user : null
}

const failRedirect = () => Response.redirect(new URL('/belepes?hiba=lejart', serverURL()).toString(), 302)

const htmlPage = (body: string, extraHeaders: Record<string, string> = {}) =>
  new Response(
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Belépés · Képtár</title></head><body>${body}</body></html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // The token is in this page's URL; don't leak it to linked sites.
        'Referrer-Policy': 'no-referrer',
        ...extraHeaders,
      },
    },
  )

/** GET: the emailed link. Shows a button that posts the token back; doesn't log in yet. */
export const confirmMagicLink: PayloadHandler = async (req) => {
  const params = req.searchParams
  const email = params.get('email')?.trim().toLowerCase() ?? ''
  const token = params.get('token') ?? ''
  if (!(await findLinkUser(req, email, token))) return failRedirect()

  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`
  return htmlPage(
    `<form method="post" action="/api/users/magic-link/verify">` +
      hidden('email', email) +
      hidden('token', token) +
      hidden('redirect', safeRedirect(params.get('redirect'))) +
      `<p>Belépés a Képtárba ezzel a címmel: <strong>${escapeHtml(email)}</strong></p>` +
      `<button type="submit">Belépés</button></form>`,
  )
}

/** POST: uses up the token and logs the user in. */
export const verifyMagicLink: PayloadHandler = async (req) => {
  const { payload } = req
  const form = await req.formData?.().catch(() => null)
  const field = (name: string) => {
    const value = form?.get(name)
    return typeof value === 'string' ? value : ''
  }
  const email = field('email').trim().toLowerCase()
  const token = field('token')
  const redirect = safeRedirect(field('redirect'))

  const user = await findLinkUser(req, email, token)
  if (!user) return failRedirect()

  // One-time use.
  await payload.db.updateOne({
    collection: 'users',
    id: user.id,
    data: { magicLinkHash: null, magicLinkExpiresAt: null },
    req,
    returning: false,
  })

  // Mirror Payload's login operation: add a session, sign the JWT, set the cookie.
  const collectionConfig = payload.collections.users.config
  user.magicLinkHash = null
  user.magicLinkExpiresAt = null
  const { sid } = await addSessionToUser({
    collectionConfig,
    payload,
    req,
    user: user as never,
  })
  const fieldsToSign = getFieldsToSign({
    collectionConfig,
    email,
    sid,
    user: { ...user, collection: 'users' } as never,
  })
  const { token: jwt } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: collectionConfig.auth.tokenExpiration,
  })
  const cookie = generatePayloadCookie({
    collectionAuthConfig: collectionConfig.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token: jwt,
  })

  // Redirect from an HTML page rather than with a 302, so the next request is a
  // plain same-site navigation (Payload ignores the auth cookie on cross-site ones).
  const target = escapeHtml(new URL(redirect, serverURL()).toString())
  return htmlPage(`<meta http-equiv="refresh" content="0;url=${target}"><p>Beléptél. <a href="${target}">Tovább</a></p>`, {
    'Set-Cookie': cookie,
  })
}
