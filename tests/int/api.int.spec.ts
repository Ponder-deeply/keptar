import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

// Runs against the seeded dev database (`pnpm seed` first).
describe('access control', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('anonymous visitors only see published artists, without private fields', async () => {
    const { docs } = await payload.find({ collection: 'artists', overrideAccess: false, limit: 100 })
    expect(docs.length).toBeGreaterThan(0)
    expect(docs.every((a) => a.status === 'published')).toBe(true)
    expect(docs.every((a) => a.email === undefined)).toBe(true)
  })

  it('anonymous visitors only see works of published artists', async () => {
    const all = await payload.find({ collection: 'works', limit: 1000, depth: 1 })
    const visible = await payload.find({ collection: 'works', overrideAccess: false, limit: 1000, depth: 1 })
    expect(visible.totalDocs).toBeLessThan(all.totalDocs)
    expect(
      visible.docs.every((w) => typeof w.artist === 'object' && w.artist.status === 'published'),
    ).toBe(true)
  })

  it('anonymous visitors cannot read inquiries or users', async () => {
    await expect(payload.find({ collection: 'inquiries', overrideAccess: false })).rejects.toThrow()
    await expect(payload.find({ collection: 'users', overrideAccess: false })).rejects.toThrow()
  })

  const visitor = async () => {
    const { docs } = await payload.find({ collection: 'users', where: { email: { equals: 'latogato@keptar.local' } } })
    return docs[0]
  }

  it('logged-in visitors cannot touch the job stats or document locks', async () => {
    const user = await visitor()
    await expect(
      payload.findGlobal({ slug: 'payload-jobs-stats' as never, overrideAccess: false, user }),
    ).rejects.toThrow()
    await expect(
      payload.updateGlobal({ slug: 'payload-jobs-stats' as never, data: {}, overrideAccess: false, user }),
    ).rejects.toThrow()
    await expect(
      payload.find({ collection: 'payload-locked-documents', overrideAccess: false, user }),
    ).rejects.toThrow()
  })

  it('a right swipe saves the work to the user, as the requester only', async () => {
    const user = await visitor()
    const admin = (await payload.find({ collection: 'users', where: { email: { equals: 'admin@keptar.local' } } }))
      .docs[0]
    const savedBefore = (user.saved ?? []).map((w) => (typeof w === 'object' ? w.id : w))
    const { docs: works } = await payload.find({
      collection: 'works',
      where: { id: { not_in: savedBefore } },
      overrideAccess: false,
      limit: 1,
    })
    const swipe = await payload.create({
      collection: 'swipes',
      // `user` is overwritten with the requester.
      data: { user: admin.id, work: works[0].id, direction: 'right' },
      user,
      overrideAccess: false,
    })
    try {
      expect(typeof swipe.user === 'object' ? swipe.user.id : swipe.user).toBe(user.id)
      const after = await payload.findByID({ collection: 'users', id: user.id, depth: 0 })
      expect(after.saved).toContain(works[0].id)
    } finally {
      await payload.delete({ collection: 'swipes', id: swipe.id })
      await payload.update({ collection: 'users', id: user.id, data: { saved: savedBefore } })
    }
  })

  it('swipes on works of unpublished artists are rejected', async () => {
    const user = await visitor()
    const { docs } = await payload.find({
      collection: 'works',
      where: { 'artist.status': { not_equals: 'published' } },
      limit: 1,
    })
    expect(docs.length).toBe(1)
    await expect(
      payload.create({
        collection: 'swipes',
        data: { user: user.id, work: docs[0].id, direction: 'right' },
        user,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('visitors see only published artists of an exhibition, and no aiTagged flag', async () => {
    const byStatus = async (status: 'published' | 'pending') =>
      (await payload.find({ collection: 'artists', where: { status: { equals: status } }, limit: 1, depth: 0 }))
        .docs[0]
    const published = await byStatus('published')
    const pending = await byStatus('pending')
    const venue = (await payload.find({ collection: 'venues', limit: 1 })).docs[0]
    const exhibition = await payload.create({
      collection: 'exhibitions',
      data: {
        title: 'Teszt kiállítás (api.int)',
        venue: venue.id,
        artists: [published.id, pending.id],
        startDate: new Date().toISOString(),
      },
    })
    try {
      const anon = await payload.findByID({ collection: 'exhibitions', id: exhibition.id, depth: 0, overrideAccess: false })
      expect(anon.artists).toEqual([published.id])
      const staff = await payload.findByID({ collection: 'exhibitions', id: exhibition.id, depth: 0 })
      expect(staff.artists).toEqual([published.id, pending.id])
    } finally {
      await payload.delete({ collection: 'exhibitions', id: exhibition.id })
    }

    const anonArtist = await payload.findByID({ collection: 'artists', id: published.id, overrideAccess: false })
    expect(anonArtist.aiTagged).toBeUndefined()
  })
})
