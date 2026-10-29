import crypto from 'crypto'
import type { PayloadHandler } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

import { clientIp, createRateLimiter } from '../lib/rateLimit'
import { serverURL } from '../lib/serverURL'

// Passwordless login for visitors. Staff can still use the admin's password login.
//
//   POST /api/users/magic-link         { email, redirect? }  -> emails a one-time link
//   GET  /api/users/magic-link/verify  ?email&token&redirect -> sets the auth cookie, redirects

const LINK_TTL_MS = 15 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

// Each request emails a link (and may create a user), so throttle per IP and per address.
const allowIp = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 })
const allowEmail = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 })

/** Only allow paths on this site, to avoid an open redirect (`//x`, `/\x` etc. resolve off-site). */
const safeRedirect = (value: unknown): string => {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  const base = new URL(serverURL())
  const url = new URL(value, base)
  return url.origin === base.origin ? `${url.pathname}${url.search}${url.hash}` : '/'
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const requestMagicLink: PayloadHandler = async (req) => {
  const body = (await req.json?.().catch(() => null)) as { email?: unknown; redirect?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) {
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
  const user =
    existing.docs[0] ??
    (await payload.create({
      collection: 'users',
      // The local strategy needs a password; nobody ever learns this one.
      data: { email, password: crypto.randomBytes(32).toString('hex'), role: 'user' },
      overrideAccess: true,
      req,
    }))

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

export const verifyMagicLink: PayloadHandler = async (req) => {
  const { payload } = req
  const params = req.searchParams
  const email = params.get('email')?.trim().toLowerCase() ?? ''
  const token = params.get('token') ?? ''
  const redirect = safeRedirect(params.get('redirect'))

  const fail = () => Response.redirect(new URL('/belepes?hiba=lejart', serverURL()).toString(), 302)

  if (!email || !token) return fail()

  const user = await payload.db.findOne<Record<string, unknown> & { id: number | string }>({
    collection: 'users',
    where: { email: { equals: email } },
    req,
  })
  if (!user || typeof user.magicLinkHash !== 'string' || !user.magicLinkExpiresAt) return fail()

  const expected = Buffer.from(user.magicLinkHash, 'hex')
  const actual = Buffer.from(hashToken(token), 'hex')
  const valid =
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual) &&
    new Date(user.magicLinkExpiresAt as string).getTime() > Date.now()
  if (!valid) return fail()

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

  // Redirect from an HTML page rather than with a 302: the user arrives from their
  // mail client, and Payload ignores the auth cookie on cross-site requests, so a
  // direct redirect would land them on a page that looks logged out.
  const target = escapeHtml(new URL(redirect, serverURL()).toString())
  return new Response(
    `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><title>Belépés · Képtár</title></head><body><p>Beléptél. <a href="${target}">Tovább</a></p></body></html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
    },
  )
}
