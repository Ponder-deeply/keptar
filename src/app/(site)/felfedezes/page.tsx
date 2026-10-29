import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import { loadRecommendations, loadSwipeContext, loadVisibleWorks } from '@/lib/recommend'
import config from '@/payload.config'

import { SwipeDeck } from './_components/SwipeDeck'
import styles from './felfedezes.module.css'

export const metadata = { title: 'Felfedezés' }

export default async function DiscoverPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers })

  const works = await loadVisibleWorks(payload, user)
  let tiers: number[][] = [works.map((w) => w.id)]

  if (user) {
    // Bias the order for logged-in users: recommended works first, then unseen
    // ones, and works they already saved or skipped last.
    const context = await loadSwipeContext(payload, user)
    const recommended = await loadRecommendations(payload, user, { works, context })
    const swiped = new Set([...context.savedIds, ...context.leftIds])
    const recIds = recommended.map((r) => r.work.id)
    const recSet = new Set(recIds)
    tiers = [
      recIds,
      works.filter((w) => !recSet.has(w.id) && !swiped.has(w.id)).map((w) => w.id),
      works.filter((w) => swiped.has(w.id)).map((w) => w.id),
    ]
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Felfedezés</h1>
      <p className={styles.intro}>
        Egyszerre egy mű. Balra: kihagyod, jobbra: elmented
        {user ? '.' : ' (a mentéshez be kell lépni).'}
      </p>
      <SwipeDeck works={works} tiers={tiers} loggedIn={Boolean(user)} />
    </div>
  )
}
