import Link from 'next/link'
import React from 'react'

import { ArtistCard } from '@/components/ArtistCard'
import { getArtistCovers } from '@/components/artistCovers'
import { getPayloadClient } from '@/components/payloadClient'

export default async function HomePage() {
  const payload = await getPayloadClient()
  const { docs: artists } = await payload.find({
    collection: 'artists',
    where: { status: { equals: 'published' } },
    sort: '-createdAt',
    limit: 4,
    depth: 1,
    overrideAccess: false,
    joins: false,
  })
  const covers = await getArtistCovers(
    payload,
    artists.map((a) => a.id),
  )

  return (
    <>
      <section className="intro">
        <h1>Képtár</h1>
        <p>
          Kortárs magyar képzőművészek egy helyen. Böngészd a művészeket médium, technika és régió
          szerint, fedezz fel új műveket, és vedd fel a kapcsolatot az alkotókkal.
        </p>
        <div className="quick-links">
          <Link href="/muveszek" className="button">
            Művészek
          </Link>
          <Link href="/felfedezes" className="button button--secondary">
            Felfedezés
          </Link>
          <Link href="/kiallitasok" className="button button--secondary">
            Kiállítások
          </Link>
        </div>
      </section>

      {artists.length > 0 && (
        <section aria-labelledby="friss">
          <h2 id="friss">Legújabb művészek</h2>
          <ul className="grid">
            {artists.map((artist) => (
              <li key={artist.id}>
                <ArtistCard artist={artist} cover={covers.get(artist.id)} />
              </li>
            ))}
          </ul>
          <p>
            <Link href="/muveszek?rendezes=uj">Összes művész</Link>
          </p>
        </section>
      )}
    </>
  )
}
