// URL search params <-> Payload query for the artist directory. Pure, so it is unit-tested.
import type { Where } from 'payload'

import { REGIONS } from '@/fields/regions'

export const DIRECTORY_PAGE_SIZE = 12

export const SORTS = {
  nev: { label: 'Név szerint', sort: 'name' },
  uj: { label: 'Legújabbak elöl', sort: '-createdAt' },
} as const

export type SortKey = keyof typeof SORTS

export type DirectoryFilters = {
  medium?: string
  technika?: string
  regio?: string
  rendezes: SortKey
  oldal: number
}

type SearchParams = Record<string, string | string[] | undefined>

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const REGION_VALUES = new Set<string>(REGIONS.map((r) => r.value))

const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined

const slug = (value: string | string[] | undefined): string | undefined => {
  const v = first(value)?.toLowerCase()
  return v && SLUG_RE.test(v) ? v : undefined
}

/** Reads and validates `?medium=&technika=&regio=&rendezes=&oldal=`. Invalid values are dropped. */
export function parseDirectoryParams(params: SearchParams): DirectoryFilters {
  const regio = slug(params.regio)
  const rendezes = first(params.rendezes)
  const oldal = Number.parseInt(first(params.oldal) ?? '', 10)
  return {
    medium: slug(params.medium),
    technika: slug(params.technika),
    regio: regio && REGION_VALUES.has(regio) ? regio : undefined,
    rendezes: rendezes && rendezes in SORTS ? (rendezes as SortKey) : 'nev',
    oldal: Number.isFinite(oldal) && oldal > 0 ? oldal : 1,
  }
}

/** The `payload.find` arguments for the published artists matching the filters. */
export function buildArtistQuery(filters: DirectoryFilters): {
  where: Where
  sort: string
  page: number
  limit: number
} {
  const and: Where[] = [{ status: { equals: 'published' } }]
  if (filters.medium) and.push({ 'medium.slug': { equals: filters.medium } })
  if (filters.technika) and.push({ 'technique.slug': { equals: filters.technika } })
  if (filters.regio) and.push({ region: { equals: filters.regio } })
  return {
    where: { and },
    sort: SORTS[filters.rendezes].sort,
    page: filters.oldal,
    limit: DIRECTORY_PAGE_SIZE,
  }
}

/** A directory URL for the filters, with `overrides` applied. Defaults are left out. */
export function directoryHref(filters: DirectoryFilters, overrides: Partial<DirectoryFilters> = {}): string {
  const merged = { ...filters, ...overrides }
  const params = new URLSearchParams()
  if (merged.medium) params.set('medium', merged.medium)
  if (merged.technika) params.set('technika', merged.technika)
  if (merged.regio) params.set('regio', merged.regio)
  if (merged.rendezes !== 'nev') params.set('rendezes', merged.rendezes)
  if (merged.oldal > 1) params.set('oldal', String(merged.oldal))
  const query = params.toString()
  return query ? `/muveszek?${query}` : '/muveszek'
}

export const hasActiveFilters = (f: DirectoryFilters) => Boolean(f.medium || f.technika || f.regio)
