import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import { loadRecommendations, loadSwipeContext, loadVisibleWorks } from '@/lib/recommend'
import { WorkMedia } from '@/components/WorkMedia'
import config from '@/payload.config'
import type { Work } from '@/payload-types'

import { removeSaved } from './actions'
import styles from './mentett.module.css'

export const metadata = { title: 'Mentett művek' }

const RECOMMENDATION_LIMIT = 6

function WorkItem({ work, children }: { work: Work; children?: React.ReactNode }) {
  return (
    <li className={styles.item}>
      <WorkMedia work={work} sizes="(max-width: 640px) 100vw, 260px" linkArtist />
      {children}
    </li>
  )
}

export default async function SavedPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers })

  if (!user) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Mentett művek</h1>
        <p>
          A mentett műveidet belépés után látod.{' '}
          <Link href="/belepes?vissza=/mentett">Belépés</Link>
        </p>
      </div>
    )
  }

  const [works, context] = await Promise.all([loadVisibleWorks(payload, user), loadSwipeContext(payload, user)])
  const byId = new Map(works.map((w) => [w.id, w]))
  // Newest saves first; works no longer visible (e.g. hidden artist) are skipped.
  const saved = [...context.savedIds]
    .reverse()
    .map((id) => byId.get(id))
    .filter((w): w is Work => Boolean(w))
  const recommended = await loadRecommendations(payload, user, {
    works,
    context,
    limit: RECOMMENDATION_LIMIT,
  })

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Mentett művek</h1>

      {saved.length === 0 ? (
        <p>
          Még nincs mentett műved. <Link href="/felfedezes">Fedezz fel műveket</Link>, és húzd
          jobbra, amelyik tetszik.
        </p>
      ) : (
        <ul className={styles.grid} aria-label="Mentett művek">
          {saved.map((work) => (
            <WorkItem key={work.id} work={work}>
              <form action={removeSaved}>
                <input type="hidden" name="work" value={work.id} />
                <button type="submit" className={styles.remove}>
                  Eltávolítás
                  <span className={styles.srOnly}>: {work.title || 'Cím nélkül'}</span>
                </button>
              </form>
            </WorkItem>
          ))}
        </ul>
      )}

      {recommended.length > 0 && (
        <section aria-labelledby="ajanlott">
          <h2 id="ajanlott" className={styles.subheading}>
            Neked ajánljuk
          </h2>
          <ul className={styles.grid}>
            {recommended.map(({ work }) => (
              <WorkItem key={work.id} work={work} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
