import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import type { Artist, Work } from '@/payload-types'

import { asArtist, asMedia, instagramProfileUrl, mediaPath } from './format'
import { IgEmbed } from './IgEmbed'
import { parseIgPermalink } from './igPermalink'

export type WorkMediaProps = {
  work: Work
  /** Needed for the credit when `work.artist` is not populated (depth 0). */
  artist?: Pick<Artist, 'handle' | 'name'>
  /** Image size for uploaded works: `thumb` (400px wide) or `large` (1600px, falls back to the original). */
  size?: 'thumb' | 'large'
  /** next/image `sizes` attribute. */
  sizes?: string
  /** Load the image eagerly (above the fold) instead of lazily. */
  eager?: boolean
  /** Show the caption with title and credit (default true). */
  caption?: boolean
  /** In the caption, link the artist's name to their profile on this site. */
  linkArtist?: boolean
  className?: string
}

/**
 * Renders any Work: an uploaded image via next/image, or an Instagram post via the
 * official embed. The caption always credits the artist and links back to Instagram.
 */
export function WorkMedia({
  work,
  artist,
  size = 'thumb',
  sizes = '(max-width: 640px) 100vw, 400px',
  eager = false,
  caption = true,
  linkArtist = false,
  className,
}: WorkMediaProps) {
  const credit = artist ?? asArtist(work.artist)
  const handle = credit?.handle
  const igPermalink = work.source === 'instagram' ? parseIgPermalink(work.igUrl) : null
  const title = work.title || (work.source === 'instagram' ? 'Instagram-poszt' : 'Cím nélkül')

  return (
    <figure className={['work', className].filter(Boolean).join(' ')}>
      <div className="work__media">
        {work.source === 'upload' ? (
          <UploadImage work={work} size={size} sizes={sizes} eager={eager} title={title} />
        ) : work.igUrl ? (
          <IgEmbed url={work.igUrl} handle={handle} title={work.title ?? undefined} />
        ) : (
          <div className="work__missing">Nincs kép</div>
        )}
      </div>
      {caption && (
        <figcaption className="work__caption">
          <span className="work__title">
            {title}
            {work.year ? `, ${work.year}` : ''}
          </span>
          {credit && (
            <span className="work__credit">
              {linkArtist ? <Link href={`/muveszek/${credit.handle}`}>{credit.name}</Link> : credit.name}
              {' · '}
              <a href={igPermalink ?? instagramProfileUrl(credit.handle)} target="_blank" rel="noopener noreferrer">
                @{credit.handle} az Instagramon
              </a>
            </span>
          )}
        </figcaption>
      )}
    </figure>
  )
}

function UploadImage({
  work,
  size,
  sizes,
  eager,
  title,
}: {
  work: Work
  size: 'thumb' | 'large'
  sizes: string
  eager: boolean
  title: string
}) {
  const media = asMedia(work.image)
  if (!media) return <div className="work__missing">Nincs kép</div>

  const variant = media.sizes?.[size]
  const src = mediaPath(variant?.url) ?? mediaPath(media.url)
  const width = (variant?.url && variant.width) || media.width
  const height = (variant?.url && variant.height) || media.height
  if (!src || !width || !height) return <div className="work__missing">Nincs kép</div>

  return (
    <Image
      src={src}
      alt={media.alt || title}
      width={width}
      height={height}
      sizes={sizes}
      loading={eager ? 'eager' : 'lazy'}
    />
  )
}
