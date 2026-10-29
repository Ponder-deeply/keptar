import type { Metadata } from 'next'
import React from 'react'

import { externalUrl } from '@/components/format'
import { getPayloadClient } from '@/components/payloadClient'
import { VenueMap, type VenuePin } from '@/components/VenueMap'

export const metadata: Metadata = { title: 'Helyszínek' }

const VENUE_TYPES: Record<string, string> = {
  gallery: 'Galéria',
  museum: 'Múzeum',
  studio: 'Műterem',
  'cultural-centre': 'Kulturális központ',
  other: 'Egyéb',
}

export default async function VenuesPage() {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'venues',
    sort: 'name',
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })

  const pins: VenuePin[] = docs.map((v) => ({
    id: v.id,
    name: v.name,
    type: VENUE_TYPES[v.type],
    address: [v.city, v.address].filter(Boolean).join(', ') || undefined,
    lat: v.lat,
    lng: v.lng,
  }))

  return (
    <>
      <h1>Helyszínek</h1>
      {docs.length === 0 ? (
        <p>Még nincs felvett helyszín.</p>
      ) : (
        <>
          <VenueMap venues={pins} />
          <ul className="venue-list">
            {docs.map((v) => {
              const site = externalUrl(v.website)
              return (
                <li key={v.id} id={`helyszin-${v.id}`} className="venue">
                  <h3>{v.name}</h3>
                  <p className="muted">{VENUE_TYPES[v.type]}</p>
                  {(v.city || v.address) && <p>{[v.city, v.address].filter(Boolean).join(', ')}</p>}
                  {site && (
                    <p>
                      <a href={site} target="_blank" rel="noopener noreferrer">
                        Weboldal
                      </a>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}
