import type { Payload } from 'payload'

import type { Media } from '@/payload-types'

import { asMedia } from './format'

/** The first uploaded image of each artist, for directory thumbnails. Access rules apply. */
export async function getArtistCovers(payload: Payload, artistIds: number[]): Promise<Map<number, Media>> {
  const covers = new Map<number, Media>()
  if (artistIds.length === 0) return covers

  const { docs } = await payload.find({
    collection: 'works',
    where: { and: [{ artist: { in: artistIds } }, { source: { equals: 'upload' } }] },
    sort: 'createdAt',
    depth: 1,
    limit: artistIds.length * 10,
    pagination: false,
    overrideAccess: false,
    select: { artist: true, image: true },
    populate: { artists: { handle: true } },
  })

  for (const work of docs) {
    const artistId = typeof work.artist === 'object' ? work.artist.id : work.artist
    const media = asMedia(work.image)
    if (media && !covers.has(artistId)) covers.set(artistId, media)
  }
  return covers
}
