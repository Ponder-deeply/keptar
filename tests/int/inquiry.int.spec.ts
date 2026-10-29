import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Artist } from '@/payload-types'

// The server action reads the client IP from request headers; outside Next there is no request.
let fakeIp = '203.0.113.1'
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': fakeIp }),
}))

const { submitInquiry } = await import('@/app/(site)/erdeklodes/actions')

let payload: Payload
const TEST_EMAIL_DOMAIN = '@inquiry-test.example'
let ipCounter = 0
const nextIp = () => {
  ipCounter += 1
  fakeIp = `198.51.100.${ipCounter}`
}

const findArtist = async (handle: string): Promise<Artist> => {
  const { docs } = await payload.find({
    collection: 'artists',
    where: { handle: { equals: handle } },
    limit: 1,
    overrideAccess: true,
  })
  return docs[0]
}

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const testInquiries = async () =>
  (
    await payload.find({
      collection: 'inquiries',
      where: { senderEmail: { like: TEST_EMAIL_DOMAIN } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
  ).docs

const cleanup = () =>
  payload.delete({
    collection: 'inquiries',
    where: { senderEmail: { like: TEST_EMAIL_DOMAIN } },
    overrideAccess: true,
  })

// Runs against the seeded dev database (`pnpm seed` first).
describe('inquiries', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    delete process.env.INQUIRY_FALLBACK_EMAIL
    await cleanup()
  })
  afterAll(cleanup)

  describe('purge job', () => {
    it('deletes inquiries older than 12 months and keeps newer ones', async () => {
      const artist = await findArtist('teszt.kovacs.anna')
      const create = (i: number) =>
        payload.create({
          collection: 'inquiries',
          data: { artist: artist.id, senderEmail: `purge${i}${TEST_EMAIL_DOMAIN}`, message: 'teszt' },
          overrideAccess: true,
        })

      const now = Date.now()
      const day = 24 * 60 * 60 * 1000
      // More than the default page size (10), so a paginated delete would leave some behind.
      const old = await Promise.all(Array.from({ length: 12 }, (_, i) => create(i)))
      const fresh = await create(100)
      const almostOld = await create(101)

      for (const doc of old) {
        await payload.db.updateOne({
          collection: 'inquiries',
          id: doc.id,
          data: { createdAt: new Date(now - 400 * day).toISOString() },
        })
      }
      await payload.db.updateOne({
        collection: 'inquiries',
        id: almostOld.id,
        data: { createdAt: new Date(now - 330 * day).toISOString() },
      })

      const job = await payload.jobs.queue({ task: 'purgeInquiries', input: {} })
      await payload.jobs.runByID({ id: job.id })

      const remaining = (await testInquiries()).map((d) => d.id).sort()
      expect(remaining).toEqual([fresh.id, almostOld.id].sort())
    })
  })

  describe('submitInquiry server action', () => {
    it('stores the inquiry and emails an artist who has an email', async () => {
      nextIp()
      const artist = await findArtist('teszt.kovacs.anna')
      const { docs: works } = await payload.find({
        collection: 'works',
        where: { artist: { equals: artist.id } },
        limit: 1,
        depth: 0,
      })
      const send = vi.spyOn(payload, 'sendEmail')

      const result = await submitInquiry(
        { status: 'idle' },
        form({
          muvesz: artist.handle,
          mu: String(works[0].id),
          senderName: 'Teszt <b>Elek</b>',
          senderEmail: `vevo${TEST_EMAIL_DOMAIN}`,
          message: 'Szeretném megvenni ezt a művet. <script>alert(1)</script>',
        }),
      )

      expect(result).toEqual({ status: 'sent' })
      const [doc] = await testInquiries()
      expect(doc).toMatchObject({ artist: artist.id, work: works[0].id, delivered: true })
      expect(send).toHaveBeenCalledTimes(1)
      const message = send.mock.calls[0][0] as Record<string, string>
      expect(message.to).toBe(artist.email)
      expect(message.replyTo).toBe(`vevo${TEST_EMAIL_DOMAIN}`)
      expect(message.text).toContain(`/muveszek/${artist.handle}`)
      expect(message.html).not.toContain('<script>')
      expect(message.html).toContain('&lt;script&gt;')
    })

    it('stores undelivered when the artist has no email and there is no fallback', async () => {
      nextIp()
      const send = vi.spyOn(payload, 'sendEmail')
      const result = await submitInquiry(
        { status: 'idle' },
        form({ muvesz: 'teszt.szabo.reka', senderEmail: `a${TEST_EMAIL_DOMAIN}`, message: 'Érdekelne egy mű.' }),
      )
      expect(result).toEqual({ status: 'sent' })
      const [doc] = await testInquiries()
      expect(doc.delivered).toBe(false)
      expect(send).not.toHaveBeenCalled()
    })

    it('sends to INQUIRY_FALLBACK_EMAIL when set, still undelivered', async () => {
      nextIp()
      process.env.INQUIRY_FALLBACK_EMAIL = 'staff@keptar.local'
      const send = vi.spyOn(payload, 'sendEmail')
      await submitInquiry(
        { status: 'idle' },
        form({ muvesz: 'teszt.szabo.reka', senderEmail: `b${TEST_EMAIL_DOMAIN}`, message: 'Érdekelne egy mű.' }),
      )
      expect(send).toHaveBeenCalledTimes(1)
      expect((send.mock.calls[0][0] as { to: string }).to).toBe('staff@keptar.local')
      const [doc] = await testInquiries()
      expect(doc.delivered).toBe(false)
    })

    it('rejects unpublished artists', async () => {
      nextIp()
      const result = await submitInquiry(
        { status: 'idle' },
        form({ muvesz: 'teszt.varga.peter', senderEmail: `c${TEST_EMAIL_DOMAIN}`, message: 'Érdekelne egy mű.' }),
      )
      expect(result.status).toBe('error')
      expect(await testInquiries()).toHaveLength(0)
    })

    it('silently drops honeypot submissions', async () => {
      nextIp()
      const result = await submitInquiry(
        { status: 'idle' },
        form({
          muvesz: 'teszt.kovacs.anna',
          senderEmail: `d${TEST_EMAIL_DOMAIN}`,
          message: 'Buy cheap stuff now!!!',
          weboldal: 'http://spam.example',
        }),
      )
      expect(result).toEqual({ status: 'sent' })
      expect(await testInquiries()).toHaveLength(0)
    })

    it('validates email and message length', async () => {
      nextIp()
      const result = await submitInquiry(
        { status: 'idle' },
        form({ muvesz: 'teszt.kovacs.anna', senderEmail: 'nem-email', message: 'rövid' }),
      )
      expect(result.status).toBe('error')
      if (result.status !== 'error') return
      expect(result.fieldErrors?.senderEmail).toBeTruthy()
      expect(result.fieldErrors?.message).toBeTruthy()
    })

    it('rate limits per IP', async () => {
      nextIp()
      const send = () =>
        submitInquiry(
          { status: 'idle' },
          form({ muvesz: 'teszt.szabo.reka', senderEmail: `rl${TEST_EMAIL_DOMAIN}`, message: 'Érdekelne egy mű.' }),
        )
      for (let i = 0; i < 5; i++) expect((await send()).status).toBe('sent')
      expect((await send()).status).toBe('error')
      expect(await testInquiries()).toHaveLength(5)
    })
  })
})
