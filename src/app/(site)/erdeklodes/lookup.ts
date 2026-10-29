import type { Payload } from 'payload'

import { isValidHandle, normalizeHandle } from '@/lib/validation'
import type { Artist, Work } from '@/payload-types'

export type InquiryTarget = { artist: Artist; work: Work | null }

const parseId = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value)) return null
  return Number(value)
}

/**
 * Resolves the artist (and optional work) an inquiry is about. Only published
 * artists qualify. A work that doesn't exist or belongs to another artist is
 * ignored rather than failing the whole page. Runs with overrideAccess so the
 * server can read the artist's private email; never pass the result to the client.
 */
export async function findInquiryTarget(
  payload: Payload,
  handle: unknown,
  workId: unknown,
): Promise<InquiryTarget | null> {
  if (typeof handle !== 'string') return null
  const normalized = normalizeHandle(handle)
  if (!isValidHandle(normalized)) return null

  const { docs } = await payload.find({
    collection: 'artists',
    where: { and: [{ handle: { equals: normalized } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const artist = docs[0]
  if (!artist) return null

  let work: Work | null = null
  const id = parseId(workId)
  if (id !== null) {
    const { docs: works } = await payload.find({
      collection: 'works',
      where: { and: [{ id: { equals: id } }, { artist: { equals: artist.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    work = works[0] ?? null
  }

  return { artist, work }
}
