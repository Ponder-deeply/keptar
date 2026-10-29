import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { ArtistCard } from '@/components/ArtistCard'
import { getArtistCovers } from '@/components/artistCovers'
import { getPayloadClient } from '@/components/payloadClient'
import { REGIONS } from '@/fields/regions'

import { buildArtistQuery, directoryHref, hasActiveFilters, parseDirectoryParams, SORTS } from './query'

export const metadata: Metadata = { title: 'Művészek' }

export default async function DirectoryPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseDirectoryParams(await props.searchParams)
  const payload = await getPayloadClient()

  const [result, tags] = await Promise.all([
    payload.find({
      collection: 'artists',
      ...buildArtistQuery(filters),
      depth: 1,
      overrideAccess: false,
      joins: false,
    }),
    payload.find({
      collection: 'tags',
      where: { kind: { in: ['medium', 'technique'] } },
      sort: 'name',
      pagination: false,
      depth: 0,
      overrideAccess: false,
    }),
  ])
  const covers = await getArtistCovers(
    payload,
    result.docs.map((a) => a.id),
  )

  const mediums = tags.docs.filter((t) => t.kind === 'medium')
  const techniques = tags.docs.filter((t) => t.kind === 'technique')

  return (
    <>
      <h1>Művészek</h1>

      <form method="get" action="/muveszek" className="filters" aria-label="Szűrők">
        <div>
          <label htmlFor="f-medium">Médium</label>
          <select id="f-medium" name="medium" defaultValue={filters.medium ?? ''}>
            <option value="">Mind</option>
            {mediums.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-technika">Technika</label>
          <select id="f-technika" name="technika" defaultValue={filters.technika ?? ''}>
            <option value="">Mind</option>
            {techniques.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-regio">Régió</label>
          <select id="f-regio" name="regio" defaultValue={filters.regio ?? ''}>
            <option value="">Mind</option>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-rendezes">Rendezés</label>
          <select id="f-rendezes" name="rendezes" defaultValue={filters.rendezes}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filters__actions">
          <button type="submit">Szűrés</button>
          {hasActiveFilters(filters) && <Link href={directoryHref(filters, { medium: undefined, technika: undefined, regio: undefined, oldal: 1 })}>Szűrők törlése</Link>}
        </div>
      </form>

      <p className="muted" aria-live="polite">
        {result.totalDocs} művész
      </p>

      {result.docs.length === 0 ? (
        <p>Nincs a szűrőknek megfelelő művész.</p>
      ) : (
        <ul className="grid">
          {result.docs.map((artist) => (
            <li key={artist.id}>
              <ArtistCard artist={artist} cover={covers.get(artist.id)} />
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 && (
        <nav className="pagination" aria-label="Lapozás">
          {result.hasPrevPage && result.prevPage ? (
            <Link href={directoryHref(filters, { oldal: result.prevPage })} rel="prev">
              ← Előző
            </Link>
          ) : (
            <span />
          )}
          <span>
            {result.page}. oldal / {result.totalPages}
          </span>
          {result.hasNextPage && result.nextPage ? (
            <Link href={directoryHref(filters, { oldal: result.nextPage })} rel="next">
              Következő →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  )
}
