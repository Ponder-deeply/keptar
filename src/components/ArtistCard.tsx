import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import type { Artist, Media } from '@/payload-types'

import { mediaPath, regionLabel, tagNames } from './format'

/** A directory entry: optional thumbnail, name, handle, medium/technique and place. */
export function ArtistCard({ artist, cover }: { artist: Artist; cover?: Media }) {
  const thumb = cover?.sizes?.thumb
  const src = mediaPath(thumb?.url) ?? mediaPath(cover?.url)
  const width = (thumb?.url && thumb.width) || cover?.width
  const height = (thumb?.url && thumb.height) || cover?.height
  const tags = [...tagNames(artist.medium), ...tagNames(artist.technique)]
  const place = [artist.city, regionLabel(artist.region)].filter(Boolean)
  // Avoid "Budapest, Budapest".
  const placeText = [...new Set(place)].join(', ')

  return (
    <article className="artist-card">
      <Link href={`/muveszek/${artist.handle}`} className="artist-card__link">
        {src && width && height ? (
          <Image src={src} alt="" width={width} height={height} sizes="(max-width: 640px) 100vw, 300px" />
        ) : (
          <div className="artist-card__placeholder" aria-hidden="true" />
        )}
        <h3 className="artist-card__name">{artist.name}</h3>
      </Link>
      <p className="artist-card__handle">@{artist.handle}</p>
      {tags.length > 0 && <p className="artist-card__tags">{tags.join(' · ')}</p>}
      {placeText && <p className="artist-card__place">{placeText}</p>}
    </article>
  )
}
