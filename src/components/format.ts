// Small formatting helpers shared by the public pages. Pure functions, safe on client and server.
import type { Artist, Media, Tag } from '@/payload-types'
import { REGIONS } from '@/fields/regions'

export const instagramProfileUrl = (handle: string) =>
  `https://www.instagram.com/${encodeURIComponent(handle)}/`

export const regionLabel = (value?: string | null): string | undefined =>
  value ? REGIONS.find((r) => r.value === value)?.label : undefined

/** Names of populated tags; unpopulated IDs are skipped. */
export const tagNames = (tags?: (number | Tag)[] | null): string[] =>
  (tags ?? []).flatMap((t) => (typeof t === 'object' && t ? [t.name] : []))

/** The populated artist of a relation, or undefined when only an ID came back. */
export const asArtist = (value: number | Artist | null | undefined): Artist | undefined =>
  typeof value === 'object' && value ? value : undefined

export const asMedia = (value: number | Media | null | undefined): Media | undefined =>
  typeof value === 'object' && value ? value : undefined

/**
 * Payload returns absolute media URLs (built from serverURL). next/image only allows
 * local `/api/media/file/**` paths, so strip the origin.
 */
export const mediaPath = (url?: string | null): string | undefined => {
  if (!url) return undefined
  if (url.startsWith('/')) return url
  try {
    const { pathname, search } = new URL(url)
    return pathname + search
  } catch {
    return undefined
  }
}

/** A safe external link: only http(s) URLs, and a bare domain gets https://. */
export const externalUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const dateFormat = new Intl.DateTimeFormat('hu-HU', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Europe/Budapest',
})

export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

export const formatDateRange = (start: string, end?: string | null) =>
  end ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start)

export const inquiryHref = (handle: string, workId?: number | string) => {
  const params = new URLSearchParams({ muvesz: handle })
  if (workId !== undefined) params.set('mu', String(workId))
  return `/erdeklodes?${params.toString()}`
}
