'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { swipeOrder } from '@/lib/recommend.order'
import type { Work } from '@/payload-types'

import styles from '../felfedezes.module.css'
import { LocalWorkMedia } from './LocalWorkMedia'
import { markSeen, restartSession, useSwipeSession } from './swipeSession'

type Direction = 'left' | 'right'

const LOGIN_HREF = '/belepes?vissza=/felfedezes'
/** Horizontal drag distance (px) that counts as a swipe. */
const SWIPE_THRESHOLD = 90

export function SwipeDeck({
  works,
  tiers,
  loggedIn,
}: {
  works: Work[]
  /** Work ids in priority groups; each group is shuffled, earlier groups first. */
  tiers: number[][]
  loggedIn: boolean
}) {
  const session = useSwipeSession()
  const byId = useMemo(() => new Map(works.map((w) => [w.id, w])), [works])
  const order = useMemo(() => (session ? swipeOrder(tiers, session.seed) : []), [tiers, session])
  const remaining = useMemo(() => {
    const seen = new Set(session?.seen ?? [])
    return order.filter((id) => !seen.has(id) && byId.has(id))
  }, [order, session, byId])

  const current = remaining.length > 0 ? byId.get(remaining[0]) : undefined
  const [status, setStatus] = useState('')
  const [error, setError] = useState<'auth' | 'server' | 'network' | null>(null)
  const [loginPrompt, setLoginPrompt] = useState(false)
  const loginLinkRef = useRef<HTMLAnchorElement>(null)

  const swipe = useCallback(
    (direction: Direction) => {
      if (!current || loginPrompt) return
      const label = current.title || 'Mű'
      if (direction === 'right' && !loggedIn) {
        setLoginPrompt(true)
        return
      }
      markSeen(current.id)
      setError(null)
      setStatus(direction === 'right' ? `Elmentve: ${label}` : `Kihagyva: ${label}`)
      if (!loggedIn) return
      fetch('/api/swipes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work: current.id, direction }),
      })
        .then((res) => {
          if (!res.ok) setError(res.status === 401 || res.status === 403 ? 'auth' : 'server')
        })
        .catch(() => setError('network'))
    },
    [current, loggedIn, loginPrompt],
  )

  const continueWithoutSaving = () => {
    setLoginPrompt(false)
    if (current) {
      markSeen(current.id)
      setStatus(`Továbbléptél mentés nélkül: ${current.title || 'Mű'}`)
    }
  }

  useEffect(() => {
    if (loginPrompt) loginLinkRef.current?.focus()
  }, [loginPrompt])

  // Arrow keys: left = skip, right = save. Escape closes the login prompt.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'Escape' && loginPrompt) {
        setLoginPrompt(false)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        swipe('left')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        swipe('right')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [swipe, loginPrompt])

  // Pointer drag (touch, pen, mouse).
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointerId: number; startX: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (loginPrompt || (event.pointerType === 'mouse' && event.button !== 0)) return
    drag.current = { pointerId: event.pointerId, startX: event.clientX, moved: false }
    suppressClick.current = false
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== event.pointerId) return
    const dx = event.clientX - d.startX
    if (!d.moved && Math.abs(dx) > 8) {
      d.moved = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (d.moved) setDragX(dx)
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.pointerId !== event.pointerId) return
    drag.current = null
    const dx = event.clientX - d.startX
    suppressClick.current = d.moved
    setDragging(false)
    setDragX(0)
    if (!cancelled && d.moved && Math.abs(dx) >= SWIPE_THRESHOLD) swipe(dx > 0 ? 'right' : 'left')
  }

  if (!session) {
    return <p className={styles.notice}>Betöltés…</p>
  }

  if (works.length === 0) {
    return <p className={styles.notice}>Még nincs megjeleníthető mű.</p>
  }

  const artist = current && typeof current.artist === 'object' ? current.artist : null
  const total = order.length
  const position = total - remaining.length + 1

  return (
    <div className={styles.deck}>
      <p className={styles.srOnly} aria-live="polite">
        {status}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error === 'auth' ? (
            <>
              Nem sikerült menteni: lejárt a belépésed. <Link href={LOGIN_HREF}>Belépés</Link>
            </>
          ) : error === 'network' ? (
            'Nem sikerült menteni: nincs kapcsolat.'
          ) : (
            'Nem sikerült menteni. Próbáld újra később.'
          )}
        </p>
      )}

      {current ? (
        <>
          <p className={styles.progress}>
            {position} / {total}
          </p>
          <div
            className={styles.card}
            data-dragging={dragging || undefined}
            data-hint={dragX > SWIPE_THRESHOLD / 2 ? 'right' : dragX < -SWIPE_THRESHOLD / 2 ? 'left' : undefined}
            style={{ transform: `translateX(${dragX}px) rotate(${dragX / 25}deg)` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endDrag(e, false)}
            onPointerCancel={(e) => endDrag(e, true)}
            onClickCapture={(e) => {
              if (suppressClick.current) {
                e.preventDefault()
                e.stopPropagation()
                suppressClick.current = false
              }
            }}
            aria-roledescription="húzható kártya"
            aria-label={`${current.title || 'Mű'}${artist ? `, ${artist.name}` : ''}`}
          >
            <LocalWorkMedia key={current.id} work={current} />
          </div>
          <div className={styles.caption}>
            <p className={styles.title}>{current.title || 'Cím nélkül'}</p>
            {artist && (
              <p>
                <Link href={`/muveszek/${artist.handle}`}>{artist.name}</Link>
              </p>
            )}
          </div>

          {loginPrompt ? (
            <div className={styles.prompt} role="alertdialog" aria-labelledby="login-prompt-title">
              <p id="login-prompt-title">A mentéshez lépj be. Böngészni belépés nélkül is lehet.</p>
              <div className={styles.actions}>
                <Link ref={loginLinkRef} href={LOGIN_HREF} className={styles.button}>
                  Belépés
                </Link>
                <button type="button" className={styles.button} onClick={continueWithoutSaving}>
                  Tovább mentés nélkül
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={() => swipe('left')}>
                ← Kihagyom
              </button>
              <button type="button" className={styles.button} onClick={() => swipe('right')}>
                Mentem →
              </button>
            </div>
          )}
          <p className={styles.hint}>
            Húzd balra a kihagyáshoz, jobbra a mentéshez, vagy használd a nyilakat.
          </p>
        </>
      ) : (
        <div className={styles.done}>
          <p>Ebben a munkamenetben minden művet láttál.</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                restartSession()
                setStatus('Újrakezdve.')
              }}
            >
              Újrakezdés
            </button>
            {loggedIn && (
              <Link href="/mentett" className={styles.button}>
                Mentett műveim
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
