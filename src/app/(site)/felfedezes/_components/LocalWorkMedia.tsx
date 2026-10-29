import Image from 'next/image'
import React from 'react'

import type { Work } from '@/payload-types'

import styles from './LocalWorkMedia.module.css'

/**
 * Payload returns absolute media URLs (prefixed with serverURL), but next.config only
 * allows local `/api/media/file/**` images, so strip our own origin.
 */
function localPath(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url, 'http://local.invalid')
    return parsed.pathname.startsWith('/api/media/file/') ? parsed.pathname + parsed.search : url
  } catch {
    return url
  }
}

/**
 * Minimal stand-in for the shared `src/components/WorkMedia.tsx` (same props), to be
 * swapped at merge. Uploads render with next/image; Instagram works render as a
 * credited link card (seed shortcodes are fake, so no embed script is loaded).
 */
export function LocalWorkMedia({ work }: { work: Work }) {
  const artist = typeof work.artist === 'object' ? work.artist : null

  if (work.source === 'upload' && work.image && typeof work.image === 'object') {
    const media = work.image
    const large = media.sizes?.large
    const src = localPath(large?.url || media.url)
    const width = (large?.url && large.width) || media.width || 1200
    const height = (large?.url && large.height) || media.height || 1200
    if (src) {
      return (
        <Image
          className={styles.image}
          src={src}
          alt={media.alt || work.title || 'Műalkotás'}
          width={width}
          height={height}
          sizes="(max-width: 640px) 100vw, 600px"
          draggable={false}
        />
      )
    }
  }

  if (work.source === 'instagram' && work.igUrl) {
    return (
      <div className={styles.igCard}>
        <p className={styles.igLabel}>Instagram-poszt</p>
        {artist && <p className={styles.igCredit}>@{artist.handle}</p>}
        <a href={work.igUrl} target="_blank" rel="noopener noreferrer" draggable={false}>
          Megnyitás az Instagramon
        </a>
      </div>
    )
  }

  return <div className={styles.missing}>Nincs megjeleníthető kép.</div>
}
