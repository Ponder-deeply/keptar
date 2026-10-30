import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import type { Artist } from '@/payload-types'

import type { ArtistCover } from './artistCovers'
import { mediaPath, regionLabel, tagNames } from './format'
import { IgEmbed } from './IgEmbed'

/** A directory entry: thumbnail (upload, else an Instagram embed), name, handle, medium/technique and place. */
export function ArtistCard({ artist, cover }: { artist: Artist; cover?: ArtistCover }) {
  const media = cover?.kind === 'image' ? cover.media : undefined
  const thumb = media?.sizes?.thumb
  const src = mediaPath(thumb?.url) ?? mediaPath(media?.url)
  const width = (thumb?.url && thumb.width) || media?.width
  const height = (thumb?.url && thumb.height) || media?.height
  const tags = [...tagNames(artist.medium), ...tagNames(artist.technique)]
  const place = [artist.city, regionLabel(artist.region)].filter(Boolean)
  // Avoid "Budapest, Budapest".
  const placeText = [...new Set(place)].join(', ')

  return (
    <article className="artist-card">
      {/* The embed has its own links, so it sits outside the card link. */}
      {cover?.kind === 'instagram' && <IgEmbed url={cover.url} handle={artist.handle} />}
      <Link href={`/muveszek/${artist.handle}`} className="artist-card__link">
        {cover?.kind === 'instagram' ? null : src && width && height ? (
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
