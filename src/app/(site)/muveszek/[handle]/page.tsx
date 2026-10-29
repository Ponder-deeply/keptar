import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { externalUrl, instagramProfileUrl, regionLabel, tagNames } from '@/components/format'
import { InquiryLink } from '@/components/InquiryLink'
import { getPayloadClient } from '@/components/payloadClient'
import { WorkMedia } from '@/components/WorkMedia'

import { getPublishedArtist } from './data'

type Props = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artist = await getPublishedArtist((await params).handle)
  if (!artist) notFound()
  return { title: artist.name, description: artist.bio ?? undefined }
}

export default async function ArtistPage({ params }: Props) {
  const artist = await getPublishedArtist((await params).handle)
  if (!artist) notFound()

  const payload = await getPayloadClient()
  const { docs: works } = await payload.find({
    collection: 'works',
    where: { artist: { equals: artist.id } },
    sort: '-createdAt',
    depth: 1,
    pagination: false,
    overrideAccess: false,
  })

  const mediums = tagNames(artist.medium)
  const techniques = tagNames(artist.technique)
  const region = regionLabel(artist.region)
  const website = externalUrl(artist.website)

  return (
    <article>
      <header className="profile-header">
        <h1>{artist.name}</h1>
        <a href={instagramProfileUrl(artist.handle)} target="_blank" rel="noopener noreferrer">
          @{artist.handle}
        </a>
      </header>

      <dl className="profile-meta">
        {mediums.length > 0 && (
          <>
            <dt>Médium</dt>
            <dd>{mediums.join(', ')}</dd>
          </>
        )}
        {techniques.length > 0 && (
          <>
            <dt>Technika</dt>
            <dd>{techniques.join(', ')}</dd>
          </>
        )}
        {region && (
          <>
            <dt>Régió</dt>
            <dd>{region}</dd>
          </>
        )}
        {artist.city && (
          <>
            <dt>Város</dt>
            <dd>{artist.city}</dd>
          </>
        )}
        {website && (
          <>
            <dt>Weboldal</dt>
            <dd>
              <a href={website} target="_blank" rel="noopener noreferrer">
                {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            </dd>
          </>
        )}
      </dl>

      {artist.bio && <p className="profile-bio">{artist.bio}</p>}

      <div className="profile-actions">
        <InquiryLink handle={artist.handle} />
      </div>

      <h2>Művek</h2>
      {works.length === 0 ? (
        <p className="muted">Még nincs feltöltött mű.</p>
      ) : (
        <ul className="works">
          {works.map((work, i) => (
            <li key={work.id}>
              <WorkMedia
                work={work}
                artist={artist}
                size="large"
                sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 400px"
                eager={i < 2}
              />
              <div>
                <InquiryLink handle={artist.handle} workId={work.id} className="button--secondary" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="opt-out">
        <Link href={`/muveszek/${artist.handle}/profil`}>Ez az én profilom / távolítsd el</Link>
      </p>
    </article>
  )
}
