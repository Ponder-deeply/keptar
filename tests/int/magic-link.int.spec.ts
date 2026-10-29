// @vitest-environment node
// (jsdom's TextEncoder breaks jose's JWT signing.)
import { getPayload, Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { confirmMagicLink, requestMagicLink, safeRedirect, verifyMagicLink } from '@/endpoints/magicLink'
import config from '@/payload.config'

let payload: Payload
// Unique per run, because the DB is shared with the dev server.
const email = `magic-${Date.now()}@magic-link-test.example`
let ipCounter = 0

const req = (init: { json?: unknown; search?: URLSearchParams; form?: URLSearchParams }) =>
  ({
    payload,
    headers: new Headers({ 'x-forwarded-for': `192.0.2.${++ipCounter}` }),
    json: async () => init.json,
    searchParams: init.search ?? new URLSearchParams(),
    formData: async () => {
      const fd = new FormData()
      for (const [k, v] of init.form ?? []) fd.set(k, v)
      return fd
    },
  }) as unknown as PayloadRequest

describe('magic link', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })
  afterAll(async () => {
    await payload.delete({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })
    vi.restoreAllMocks()
  })

  it('only redirects to paths on this site', () => {
    expect(safeRedirect('/mentett?x=1')).toBe('/mentett?x=1')
    for (const evil of ['//evil.com', '/\\evil.com', 'https://evil.com', '/.//evil.com', '/a/..//evil.com', 42]) {
      expect(safeRedirect(evil)).toBe('/')
    }
  })

  it('emails a link that survives being opened, logs in once, then expires', async () => {
    const sendEmail = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined)
    const res = await requestMagicLink(req({ json: { email, redirect: '/mentett' } }))
    expect(res.status).toBe(200)
    const text = sendEmail.mock.calls.at(-1)![0]!.text as string
    const link = new URL(text.match(/https?:\/\/\S+/)![0])
    expect(link.searchParams.get('redirect')).toBe('/mentett')

    // Opening the link (or a mail scanner opening it) shows a button and doesn't use up the token.
    for (let i = 0; i < 2; i++) {
      const page = await confirmMagicLink(req({ search: link.searchParams }))
      expect(page.status).toBe(200)
      expect(await page.text()).toContain('method="post"')
    }

    const login = await verifyMagicLink(req({ form: link.searchParams }))
    expect(login.status).toBe(200)
    expect(login.headers.get('set-cookie')).toMatch(/payload-token=/)
    expect(await login.text()).toContain('/mentett')

    const reuse = await verifyMagicLink(req({ form: link.searchParams }))
    expect(reuse.status).toBe(302)
    expect(reuse.headers.get('location')).toContain('hiba=lejart')
    const reopen = await confirmMagicLink(req({ search: link.searchParams }))
    expect(reopen.status).toBe(302)
  })

  it('rejects a wrong token and an invalid address', async () => {
    const wrong = await verifyMagicLink(req({ form: new URLSearchParams({ email, token: 'nope' }) }))
    expect(wrong.status).toBe(302)
    const bad = await requestMagicLink(req({ json: { email: 'not-an-email' } }))
    expect(bad.status).toBe(400)
  })
})
