import crypto from 'crypto'
import type { PayloadHandler, PayloadRequest } from 'payload'
import { getFieldsToSign, jwtSign } from 'payload'
import { addSessionToUser, generatePayloadCookie } from 'payload/shared'

// Passwordless login for visitors. Staff can still use the admin's password login.
//
//   POST /api/users/magic-link         { email, redirect? }  -> emails a one-time link
//   GET  /api/users/magic-link/verify  ?email&token&redirect -> sets the auth cookie, redirects

const LINK_TTL_MS = 15 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

/** Only allow same-site relative paths, to avoid an open redirect. */
const safeRedirect = (value: unknown): string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'

const serverURL = (req: PayloadRequest) => req.payload.config.serverURL || 'http://localhost:3000'

export const requestMagicLink: PayloadHandler = async (req) => {
  const body = (await req.json?.().catch(() => null)) as { email?: unknown; redirect?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Érvénytelen e-mail-cím.' }, { status: 400 })
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

  const link = new URL('/api/users/magic-link/verify', serverURL(req))
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

  const fail = () =>
    Response.redirect(new URL('/belepes?hiba=lejart', serverURL(req)).toString(), 302)

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

  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(redirect, serverURL(req)).toString(),
      'Set-Cookie': cookie,
    },
  })
}
