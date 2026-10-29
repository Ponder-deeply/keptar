import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { getPublishedArtist } from '../data'
import { ProfileRequestForm } from './ProfileRequestForm'

type Props = { params: Promise<{ handle: string }> }

export const metadata: Metadata = { title: 'Ez az én profilom', robots: { index: false } }

export default async function ProfileRequestPage({ params }: Props) {
  const artist = await getPublishedArtist((await params).handle)
  if (!artist) notFound()

  return (
    <>
      <p>
        <Link href={`/muveszek/${artist.handle}`}>← {artist.name}</Link>
      </p>
      <h1>Ez az én profilom / távolítsd el</h1>
      <p className="intro">
        A Képtár nyilvános Instagram-posztok alapján mutatja be a művészeket. Ha ez a te profilod
        (@{artist.handle}), átveheted a kezelését, vagy kérheted, hogy elrejtsük. A kérést egy kurátor
        nézi át.
      </p>
      <ProfileRequestForm handle={artist.handle} />
    </>
  )
}
