import type { Payload } from 'payload'

import type { Media } from '@/payload-types'

import { asMedia } from './format'

/** The first uploaded image of each artist, for directory thumbnails. Access rules apply. */
export async function getArtistCovers(payload: Payload, artistIds: number[]): Promise<Map<number, Media>> {
  const covers = new Map<number, Media>()
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
  artistIds.forEach((artistId, i) => {
    const media = asMedia(results[i].docs[0]?.image)
    if (media) covers.set(artistId, media)
  })
  return covers
}
