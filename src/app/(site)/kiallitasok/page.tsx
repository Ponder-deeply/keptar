import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { asArtist, externalUrl, formatDateRange } from '@/components/format'
import { getPayloadClient } from '@/components/payloadClient'
import type { Exhibition } from '@/payload-types'

export const metadata: Metadata = { title: 'Kiállítások' }

export default async function ExhibitionsPage() {
  const payload = await getPayloadClient()
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  // Current or upcoming: ends today or later; without an end date, a one-day event from today on.
  const { docs } = await payload.find({
    collection: 'exhibitions',
    where: {
      or: [
        { endDate: { greater_than_equal: startOfToday.toISOString() } },
        {
          and: [{ endDate: { exists: false } }, { startDate: { greater_than_equal: startOfToday.toISOString() } }],
        },
      ],
    },
    sort: 'startDate',
    depth: 1,
    pagination: false,
    overrideAccess: false,
  })

  const current = docs.filter((e) => new Date(e.startDate) <= now)
  const upcoming = docs.filter((e) => new Date(e.startDate) > now)

  return (
    <>
      <h1>Kiállítások</h1>
      {docs.length === 0 && <p>Jelenleg nincs meghirdetett kiállítás.</p>}
      {current.length > 0 && (
        <section aria-labelledby="most">
          <h2 id="most">Most látható</h2>
          <ExhibitionList items={current} />
        </section>
      )}
      {upcoming.length > 0 && (
        <section aria-labelledby="hamarosan">
          <h2 id="hamarosan">Hamarosan</h2>
          <ExhibitionList items={upcoming} />
        </section>
      )}
      <p>
        <Link href="/helyszinek">Helyszínek térképen</Link>
      </p>
    </>
  )
}

function ExhibitionList({ items }: { items: Exhibition[] }) {
  return (
    <ul className="exhibition-list">
      {items.map((e) => {
        const venue = typeof e.venue === 'object' ? e.venue : undefined
        // Unpublished artists come back unpopulated (access rules), so they are skipped.
        const artists = (e.artists ?? []).flatMap((a) => {
          const artist = asArtist(a)
          return artist?.status === 'published' ? [artist] : []
        })
        const link = externalUrl(e.url)
        return (
          <li key={e.id} className="exhibition">
            <h3>{e.title}</h3>
            <p>
              <time dateTime={e.startDate}>{formatDateRange(e.startDate, e.endDate)}</time>
            </p>
            {venue && (
              <p>
                {venue.name}
                {venue.city ? `, ${venue.city}` : ''}
                {venue.address ? `, ${venue.address}` : ''}
              </p>
            )}
            {artists.length > 0 && (
              <p>
                Művészek:{' '}
                {artists.map((a, i) => (
                  <React.Fragment key={a.id}>
                    {i > 0 && ', '}
                    <Link href={`/muveszek/${a.handle}`}>{a.name}</Link>
                  </React.Fragment>
                ))}
              </p>
            )}
            {e.description && <p className="muted">{e.description}</p>}
            {link && (
              <p>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  Részletek
                </a>
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
