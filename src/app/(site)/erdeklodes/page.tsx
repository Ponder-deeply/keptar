import config from '@payload-config'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import styles from './erdeklodes.module.css'
import { InquiryForm } from './InquiryForm'
import { findInquiryTarget } from './lookup'

export const metadata = {
  title: 'Érdeklődés · Képtár',
  robots: { index: false },
}

/** /erdeklodes?muvesz=<handle>&mu=<workId>: the "Érdeklődöm" form for one artist (and work). */
export default async function InquiryPage(props: {
  searchParams: Promise<{ muvesz?: string | string[]; mu?: string | string[] }>
}) {
  const { muvesz, mu } = await props.searchParams
  const payload = await getPayload({ config })
  const target = await findInquiryTarget(payload, muvesz, mu)
  if (!target) notFound()

  const { artist, work } = target

  return (
    <div className={styles.page}>
      <h1>Érdeklődés</h1>
      <p className={styles.about}>
        Üzenet neki: <Link href={`/muveszek/${encodeURIComponent(artist.handle)}`}>{artist.name}</Link>
        {work && (
          <>
            {' '}
            · a mű:{' '}
            {work.igUrl ? (
              <a href={work.igUrl} target="_blank" rel="noopener noreferrer">
                {work.title || 'Instagram poszt'}
              </a>
            ) : (
              work.title || `#${work.id}`
            )}
          </>
        )}
      </p>
      {/* Only names and ids reach the client; the artist's email stays on the server. */}
      <InquiryForm handle={artist.handle} workId={work?.id} />
    </div>
  )
}
