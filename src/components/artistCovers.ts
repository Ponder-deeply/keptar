import type { Payload, Where } from 'payload'

import type { Media } from '@/payload-types'

import { asMedia } from './format'

/** A directory thumbnail: the first uploaded image, else a random Instagram post. */
export type ArtistCover = { kind: 'image'; media: Media } | { kind: 'instagram'; url: string }

/**
 * The cover of each artist, for directory thumbnails. Access rules apply. Artists
 * without an uploaded image get a random one of their Instagram posts, picked
 * anew on every request; artists with neither get no entry.
 */
export async function getArtistCovers(
  payload: Payload,
  artistIds: number[],
  random: () => number = Math.random,
): Promise<Map<number, ArtistCover>> {
  const covers = new Map<number, ArtistCover>()
  if (artistIds.length === 0) return covers

  // One small query per artist (a page holds a few dozen): a shared limit would let
  // one artist with many uploads crowd out everyone else's cover.
  const results = await Promise.all(
    artistIds.map((artistId) =>
      payload.find({
        collection: 'works',
        where: { and: [{ artist: { equals: artistId } }, { source: { equals: 'upload' } }] },
        sort: 'createdAt',
        depth: 1,
        limit: 1,
        pagination: false,
        overrideAccess: false,
        select: { image: true },
      }),
    ),
  )
  const withoutUpload: number[] = []
  artistIds.forEach((artistId, i) => {
    const media = asMedia(results[i].docs[0]?.image)
    if (media) covers.set(artistId, { kind: 'image', media })
    else withoutUpload.push(artistId)
  })

  // Random post: count, then fetch the one at a random offset.
  await Promise.all(
    withoutUpload.map(async (artistId) => {
      const where: Where = { and: [{ artist: { equals: artistId } }, { source: { equals: 'instagram' } }] }
      const { totalDocs } = await payload.count({ collection: 'works', where, overrideAccess: false })
      if (totalDocs === 0) return
      const { docs } = await payload.find({
        collection: 'works',
        where,
        sort: 'id',
        page: Math.floor(random() * totalDocs) + 1,
        limit: 1,
        depth: 0,
        overrideAccess: false,
        select: { igUrl: true },
      })
      const url = docs[0]?.igUrl
      if (url) covers.set(artistId, { kind: 'instagram', url })
    }),
  )
  return covers
}
