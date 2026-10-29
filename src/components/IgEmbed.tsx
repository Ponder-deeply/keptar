'use client'

import React, { useEffect, useRef, useState } from 'react'

import { instagramProfileUrl } from './format'
import { parseIgPermalink } from './igPermalink'

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } }
  }
}

const EMBED_SCRIPT = 'https://www.instagram.com/embed.js'
/** How long to wait for embed.js to turn the blockquote into an iframe before giving up. */
const EMBED_TIMEOUT_MS = 10_000

let scriptPromise: Promise<void> | null = null

/** Loads Instagram's embed.js once per page. A failed load can be retried later. */
function loadEmbedScript(): Promise<void> {
  if (window.instgrm) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = EMBED_SCRIPT
      script.async = true
      script.onload = () => (window.instgrm ? resolve() : reject(new Error('instgrm missing')))
      script.onerror = () => {
        scriptPromise = null
        script.remove()
        reject(new Error('embed.js failed to load'))
      }
      document.body.appendChild(script)
    })
  }
  return scriptPromise
}

export type IgEmbedProps = {
  /** Instagram post or reel URL, e.g. https://www.instagram.com/p/ABC123/ */
  url: string
  /** The artist's Instagram handle, for the credit in the fallback. */
  handle?: string
  /** Shown in the fallback, e.g. the work's title. */
  title?: string
  className?: string
}

type Phase = 'idle' | 'loading' | 'embedded' | 'failed'

/**
 * Official Instagram embed (blockquote + embed.js), loaded only when scrolled near.
 * Until then, without JS, or if the embed fails, it shows a link to the post instead.
 */
export function IgEmbed({ url, handle, title, className }: IgEmbedProps) {
  const permalink = parseIgPermalink(url)
  const rootRef = useRef<HTMLDivElement>(null)
  // React never renders children into the slot, so embed.js may replace its contents freely.
  const slotRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  useEffect(() => {
    const root = rootRef.current
    const slot = slotRef.current
    if (!permalink || !root || !slot) return

    let cancelled = false
    let poll: ReturnType<typeof setInterval> | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined

    const start = async () => {
      setPhase('loading')
      slot.innerHTML = blockquoteHtml(permalink)
      try {
        await loadEmbedScript()
        if (cancelled) return
        window.instgrm?.Embeds.process()
      } catch {
        if (!cancelled) fail()
        return
      }
      poll = setInterval(() => {
        if (slot.querySelector('iframe')) {
          clearInterval(poll)
          clearTimeout(timeout)
          if (!cancelled) setPhase('embedded')
        }
      }, 300)
      timeout = setTimeout(() => {
        clearInterval(poll)
        if (!cancelled && !slot.querySelector('iframe')) fail()
      }, EMBED_TIMEOUT_MS)
    }

    const fail = () => {
      slot.innerHTML = ''
      setPhase('failed')
    }

    if (!('IntersectionObserver' in window)) {
      void start()
      return () => {
        cancelled = true
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          void start()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(root)

    return () => {
      cancelled = true
      observer.disconnect()
      clearInterval(poll)
      clearTimeout(timeout)
    }
  }, [permalink])

  const fallbackHref = permalink ?? (handle ? instagramProfileUrl(handle) : url)
  const showFallback = phase === 'idle' || phase === 'failed'

  return (
    <div
      ref={rootRef}
      className={['ig-embed', className].filter(Boolean).join(' ')}
      data-phase={phase}
    >
      <div ref={slotRef} className="ig-embed__slot" />
      {showFallback && (
        <div className="ig-embed__fallback">
          <p className="ig-embed__label">
            {title || 'Instagram-poszt'}
            {handle ? ` · @${handle}` : ''}
            {phase === 'failed' && <span className="ig-embed__note"> (a beágyazás nem töltődött be)</span>}
          </p>
          <a href={fallbackHref} target="_blank" rel="noopener noreferrer">
            Megnézem az Instagramon
          </a>
        </div>
      )}
    </div>
  )
}

/** The official embed markup. `permalink` comes from parseIgPermalink, so it is attribute-safe. */
function blockquoteHtml(permalink: string): string {
  const href = `${permalink}?utm_source=ig_embed&amp;utm_campaign=loading`
  return (
    `<blockquote class="instagram-media" data-instgrm-permalink="${href}" data-instgrm-version="14">` +
    `<a href="${href}" target="_blank" rel="noopener noreferrer">Megnézem az Instagramon</a>` +
    `</blockquote>`
  )
}
