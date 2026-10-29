import { getPayload, Payload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { submitProfileRequest } from '@/app/(site)/muveszek/[handle]/profil/actions'
import { getPublishedArtist, normaliseHandle } from '@/app/(site)/muveszek/[handle]/data'
import {
  buildArtistQuery,
  directoryHref,
  parseDirectoryParams,
} from '@/app/(site)/muveszek/query'
import { externalUrl, inquiryHref, mediaPath } from '@/components/format'
import { parseIgPermalink } from '@/components/igPermalink'
import config from '@/payload.config'

// The opt-out action rate-limits by client IP from request headers; outside Next there is no request.
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.77' }),
}))

describe('directory query (pure)', () => {
  it('parses and validates search params', () => {
    expect(parseDirectoryParams({ medium: 'festeszet', technika: 'olaj', regio: 'budapest' })).toEqual({
      medium: 'festeszet',
      technika: 'olaj',
      regio: 'budapest',
      rendezes: 'nev',
      oldal: 1,
    })
    expect(
      parseDirectoryParams({ medium: 'Bad Slug!', regio: 'atlantis', rendezes: 'x', oldal: '-3' }),
    ).toEqual({ medium: undefined, technika: undefined, regio: undefined, rendezes: 'nev', oldal: 1 })
    expect(parseDirectoryParams({ medium: ['grafika', 'olaj'], rendezes: 'uj', oldal: '2' })).toMatchObject({
      medium: 'grafika',
      rendezes: 'uj',
      oldal: 2,
    })
  })

  it('builds the Payload query', () => {
    const q = buildArtistQuery(parseDirectoryParams({ medium: 'festeszet', regio: 'budapest', rendezes: 'uj', oldal: '2' }))
    expect(q.sort).toBe('-createdAt')
    expect(q.page).toBe(2)
    expect(q.where).toEqual({
      and: [
        { status: { equals: 'published' } },
        { 'medium.slug': { equals: 'festeszet' } },
        { region: { equals: 'budapest' } },
      ],
    })
  })

  it('builds directory links without default values', () => {
    const f = parseDirectoryParams({ medium: 'festeszet', oldal: '3' })
    expect(directoryHref(f)).toBe('/muveszek?medium=festeszet&oldal=3')
    expect(directoryHref(f, { oldal: 1 })).toBe('/muveszek?medium=festeszet')
    expect(directoryHref(parseDirectoryParams({}))).toBe('/muveszek')
  })
})

describe('helpers (pure)', () => {
  it('parses Instagram permalinks', () => {
    expect(parseIgPermalink('https://www.instagram.com/p/ABC_12-x/?igsh=1')).toBe('https://www.instagram.com/p/ABC_12-x/')
    expect(parseIgPermalink('https://instagram.com/reel/XYZ')).toBe('https://www.instagram.com/reel/XYZ/')
    expect(parseIgPermalink('https://evil.example/p/ABC/')).toBeNull()
    expect(parseIgPermalink('https://www.instagram.com/p/"onload=x/')).toBeNull()
  })

  it('formats links', () => {
    expect(inquiryHref('a.b', 7)).toBe('/erdeklodes?muvesz=a.b&mu=7')
    expect(mediaPath('http://localhost:3002/api/media/file/x.jpg')).toBe('/api/media/file/x.jpg')
    expect(externalUrl('example.com')).toBe('https://example.com/')
    expect(externalUrl('javascript:alert(1)')).toBeUndefined()
    expect(normaliseHandle('%40Teszt.Kovacs.Anna')).toBe('teszt.kovacs.anna')
    expect(normaliseHandle('../etc')).toBeNull()
  })
})

// The rest runs against the seeded dev database (`pnpm seed` first).
describe('public data access', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('filters artists by medium, technique and region', async () => {
    const find = (params: Record<string, string>) =>
      payload.find({ collection: 'artists', ...buildArtistQuery(parseDirectoryParams(params)), overrideAccess: false })
    const painters = await find({ medium: 'festeszet' })
    expect(painters.docs.map((a) => a.handle).sort()).toEqual(['teszt.horvath.lili', 'teszt.kovacs.anna'])
    const oil = await find({ medium: 'festeszet', technika: 'olaj', regio: 'budapest' })
    expect(oil.docs.map((a) => a.handle)).toEqual(['teszt.kovacs.anna'])
    // The only sculptor is pending, so invisible.
    expect((await find({ medium: 'szobraszat' })).totalDocs).toBe(0)
  })

  it('profiles only resolve for published artists, without staff-only fields', async () => {
    const anna = await getPublishedArtist('teszt.kovacs.anna')
    expect(anna?.name).toBe('Kovács Anna (teszt)')
    expect(anna?.email).toBeUndefined()
    expect(anna?.curatorNotes).toBeUndefined()
    expect(await getPublishedArtist('teszt.varga.peter')).toBeNull()
  })

  it('the opt-out action records a request, and the honeypot drops bots', async () => {
    const before = await payload.count({ collection: 'profile-requests' })

    const form = (fields: Record<string, string>) => {
      const fd = new FormData()
      for (const [k, v] of Object.entries(fields)) fd.set(k, v)
      return fd
    }

    const ok = await submitProfileRequest(
      { status: 'idle' },
      form({ handle: 'teszt.kovacs.anna', email: 'anna@example.com', type: 'remove', message: 'Teszt' }),
    )
    expect(ok).toEqual({ status: 'ok', type: 'remove' })

    const bot = await submitProfileRequest(
      { status: 'idle' },
      form({ handle: 'teszt.kovacs.anna', email: 'bot@example.com', type: 'claim', website: 'http://spam' }),
    )
    expect(bot.status).toBe('ok')

    const bad = await submitProfileRequest({ status: 'idle' }, form({ handle: 'teszt.kovacs.anna', email: 'nope', type: 'claim' }))
    expect(bad.status).toBe('error')

    const hidden = await submitProfileRequest(
      { status: 'idle' },
      form({ handle: 'teszt.varga.peter', email: 'p@example.com', type: 'claim' }),
    )
    expect(hidden.status).toBe('error')

    const after = await payload.count({ collection: 'profile-requests' })
    expect(after.totalDocs).toBe(before.totalDocs + 1)

    // Five requests per hour per IP; the first one above counts.
    for (let i = 0; i < 4; i++) {
      const again = await submitProfileRequest(
        { status: 'idle' },
        form({ handle: 'teszt.kovacs.anna', email: 'anna@example.com', type: 'claim' }),
      )
      expect(again.status).toBe('ok')
    }
    const limited = await submitProfileRequest(
      { status: 'idle' },
      form({ handle: 'teszt.kovacs.anna', email: 'anna@example.com', type: 'claim' }),
    )
    expect(limited).toMatchObject({ status: 'error', message: expect.stringContaining('Túl sok') })

    // Clean up the test record.
    await payload.delete({
      collection: 'profile-requests',
      where: { email: { equals: 'anna@example.com' } },
      overrideAccess: true,
    })
  })
})
