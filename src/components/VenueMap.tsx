'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import React, { useEffect, useRef, useState } from 'react'

export type VenuePin = {
  id: number
  name: string
  type?: string
  address?: string
  lat: number
  lng: number
}

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> közreműködők',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

/** Centre of Hungary, used when there are no venues. */
const HUNGARY: [number, number] = [19.5, 47.16]

/**
 * MapLibre map with a marker per venue. maplibre-gl is imported only in the browser,
 * so server rendering just outputs the empty container.
 */
export function VenueMap({ venues }: { venues: VenuePin[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let map: MapLibreMap | undefined
    let cancelled = false

    import('maplibre-gl')
      .then(({ Map, Marker, Popup, NavigationControl, LngLatBounds }) => {
        if (cancelled) return
        map = new Map({
          container,
          style: OSM_STYLE,
          center: HUNGARY,
          zoom: 6,
          cooperativeGestures: true,
        })
        map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

        const bounds = new LngLatBounds()
        for (const venue of venues) {
          bounds.extend([venue.lng, venue.lat])
          new Marker({ color: '#0b57d0' })
            .setLngLat([venue.lng, venue.lat])
            .setPopup(new Popup({ offset: 24 }).setDOMContent(popupContent(venue)))
            .addTo(map)
        }
        if (venues.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 })
        else if (venues.length === 1) map.jumpTo({ center: [venues[0].lng, venues[0].lat], zoom: 13 })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [venues])

  return (
    <>
      <div
        ref={containerRef}
        className="venue-map"
        role="region"
        aria-label="Helyszínek térképe (a lista lent olvasható)"
        hidden={failed}
      />
      {failed && <p className="notice">A térkép nem töltődött be. A helyszínek listája lent olvasható.</p>}
    </>
  )
}

/** Popup content built as DOM nodes, so venue names never go through innerHTML. */
function popupContent(venue: VenuePin): HTMLElement {
  const root = document.createElement('div')
  root.className = 'venue-map__popup'
  const title = document.createElement('h3')
  title.textContent = venue.name
  root.append(title)
  for (const text of [venue.type, venue.address]) {
    if (!text) continue
    const p = document.createElement('p')
    p.textContent = text
    root.append(p)
  }
  const link = document.createElement('a')
  link.href = `#helyszin-${venue.id}`
  link.textContent = 'Részletek a listában'
  root.append(link)
  return root
}
