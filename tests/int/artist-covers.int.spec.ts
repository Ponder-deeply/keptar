import { getPayload, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getArtistCovers } from '@/components/artistCovers'
import config from '@/payload.config'

let payload: Payload
const suffix = Date.now().toString(36)
const created: { artists: number[]; works: number[] } = { artists: [], works: [] }

async function artistWithPosts(status: 'published' | 'pending', shortcodes: string[]) {
  const artist = await payload.create({
    collection: 'artists',
    data: { handle: `teszt.cover.${status}.${suffix}`, name: 'Borító Teszt', status },
    overrideAccess: true,
  })
  created.artists.push(artist.id)
  for (const code of shortcodes) {
    const work = await payload.create({
      collection: 'works',
      data: { artist: artist.id, source: 'instagram', igUrl: `https://www.instagram.com/p/${code}${suffix}/` },
      overrideAccess: true,
    })
    created.works.push(work.id)
  }
  return artist.id
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  for (const id of created.works) await payload.delete({ collection: 'works', id, overrideAccess: true })
  for (const id of created.artists) await payload.delete({ collection: 'artists', id, overrideAccess: true })
})

describe('getArtistCovers', () => {
  it('uses the first upload when there is one', async () => {
    const { docs } = await payload.find({
      collection: 'artists',
      where: { handle: { equals: 'teszt.kovacs.anna' } },
      overrideAccess: true,
    })
    const covers = await getArtistCovers(payload, [docs[0].id])
    expect(covers.get(docs[0].id)?.kind).toBe('image')
  })

  it('falls back to a random Instagram post, chosen by the random source', async () => {
    const id = await artistWithPosts('published', ['COVA', 'COVB', 'COVC'])
    const first = (await getArtistCovers(payload, [id], () => 0)).get(id)
    const last = (await getArtistCovers(payload, [id], () => 0.999)).get(id)
    expect(first).toEqual({ kind: 'instagram', url: `https://www.instagram.com/p/COVA${suffix}/` })
    expect(last).toEqual({ kind: 'instagram', url: `https://www.instagram.com/p/COVC${suffix}/` })
  })

  it('gives anonymous visitors nothing for an unpublished artist', async () => {
    const id = await artistWithPosts('pending', ['COVP'])
    expect((await getArtistCovers(payload, [id])).has(id)).toBe(false)
  })
})
