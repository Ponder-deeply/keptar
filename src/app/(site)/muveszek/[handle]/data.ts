import { cache } from 'react'

import { getPayloadClient } from '@/components/payloadClient'
import { isValidHandle, normalizeHandle } from '@/lib/validation'

/** Normalises a handle from the URL; null when it cannot be an Instagram name. */
export function normaliseHandle(raw: string): string | null {
  let value: string
  try {
    value = decodeURIComponent(raw)
  } catch {
    return null
  }
  value = normalizeHandle(value)
  return isValidHandle(value) ? value : null
}

/**
 * A published artist by handle, as an anonymous visitor sees it (access rules apply, so
 * staff-only fields are stripped). Cached per request: metadata and page share one query.
 */
export const getPublishedArtist = cache(async (rawHandle: string) => {
  const handle = normaliseHandle(rawHandle)
  if (!handle) return null
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'artists',
    where: { and: [{ handle: { equals: handle } }, { status: { equals: 'published' } }] },
    depth: 1,
    limit: 1,
    overrideAccess: false,
    // The works join is queried separately, with its own access check.
    joins: false,
  })
  return docs[0] ?? null
})
