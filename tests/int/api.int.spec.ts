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

  it('a right swipe saves the work to the user', async () => {
    const { docs: users } = await payload.find({
      collection: 'users',
      where: { email: { equals: 'latogato@keptar.local' } },
    })
    const user = users[0]
    const { docs: works } = await payload.find({ collection: 'works', overrideAccess: false, limit: 1 })
    await payload.create({
      collection: 'swipes',
      data: { user: user.id, work: works[0].id, direction: 'right' },
      user,
      overrideAccess: false,
    })
    const after = await payload.findByID({ collection: 'users', id: user.id, depth: 0 })
    expect(after.saved).toContain(works[0].id)
  })
})
