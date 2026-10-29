'use client'

import { useMemo, useSyncExternalStore } from 'react'

// Per-tab swipe session: a shuffle seed plus the ids already shown. Kept in
// sessionStorage so a reload continues without repeats; falls back to memory
// when storage is unavailable (private mode, blocked site data).

const KEY = 'keptar:felfedezes:v1'

export type SwipeSession = { seed: number; seen: number[] }

const listeners = new Set<() => void>()
let cache: string | null = null

const newSession = (): SwipeSession => ({
  seed: Math.floor(Math.random() * 2 ** 31),
  seen: [],
})

function parse(raw: string | null): SwipeSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<SwipeSession>
    if (typeof value.seed !== 'number' || !Array.isArray(value.seen)) return null
    return { seed: value.seed, seen: value.seen.filter((id) => typeof id === 'number') }
  } catch {
    return null
  }
}

function persist(session: SwipeSession): string {
  const raw = JSON.stringify(session)
  cache = raw
  try {
    window.sessionStorage.setItem(KEY, raw)
  } catch {
    // Storage unavailable: the in-memory copy still works for this page view.
  }
  return raw
}

function write(session: SwipeSession) {
  persist(session)
  listeners.forEach((listener) => listener())
}

function getSnapshot(): string {
  if (cache == null) {
    let stored: string | null = null
    try {
      stored = window.sessionStorage.getItem(KEY)
    } catch {
      stored = null
    }
    cache = stored && parse(stored) ? stored : persist(newSession())
  }
  return cache
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Returns the session (null during server render / before hydration). */
export function useSwipeSession(): SwipeSession | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null)
  return useMemo(() => (raw == null ? null : parse(raw)), [raw])
}

export function markSeen(id: number) {
  const current = parse(getSnapshot()) ?? newSession()
  if (current.seen.includes(id)) return
  write({ ...current, seen: [...current.seen, id] })
}

export function restartSession() {
  write(newSession())
}
