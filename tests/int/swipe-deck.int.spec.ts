import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Artist, Work } from '@/payload-types'

const ts = '2026-01-01T00:00:00.000Z'
const artist = { id: 1, handle: 'teszt', name: 'Teszt Művész', status: 'published', updatedAt: ts, createdAt: ts } as Artist
const works: Work[] = [1, 2, 3].map((id) => ({
  id,
  artist,
  title: `Mű ${id}`,
  source: 'instagram',
  igUrl: `https://www.instagram.com/p/TESZT${id}/`,
  updatedAt: ts,
  createdAt: ts,
}))

// The session store keeps a module-level cache, so load a fresh copy per test.
async function renderDeck(loggedIn: boolean) {
  vi.resetModules()
  const { SwipeDeck } = await import('@/app/(site)/felfedezes/_components/SwipeDeck')
  return render(createElement(SwipeDeck, { works, tiers: [[1, 2, 3]], loggedIn }))
}

const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }))

describe('SwipeDeck', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.sessionStorage.clear()
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows each work once per session, survives a remount, and can restart', async () => {
    const first = await renderDeck(false)
    const seen = new Set<string>()
    const card = () => document.querySelector('[aria-roledescription]')!.getAttribute('aria-label')!
    seen.add(card())
    key('ArrowLeft')
    const second = card()
    expect(seen.has(second)).toBe(false)
    seen.add(second)
    key('ArrowLeft')
    const third = card()
    first.unmount()

    // A reload in the same tab continues where it left off (the unswiped third work).
    await renderDeck(false)
    expect(card()).toBe(third)
    seen.add(third)
    expect(seen.size).toBe(3)
    key('ArrowLeft')
    expect(screen.getByText('Ebben a munkamenetben minden művet láttál.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Újrakezdés' }))
    expect(document.querySelector('[aria-roledescription]')).not.toBeNull()
  })

  it('prompts anonymous visitors to log in on a right swipe', async () => {
    await renderDeck(false)
    const before = document.querySelector('[aria-roledescription]')!.getAttribute('aria-label')
    key('ArrowRight')
    const login = screen.getByRole('link', { name: 'Belépés' })
    expect(login.getAttribute('href')).toBe('/belepes?vissza=/felfedezes')
    expect(document.querySelector('[aria-roledescription]')!.getAttribute('aria-label')).toBe(before)
    fireEvent.click(screen.getByRole('button', { name: 'Tovább mentés nélkül' }))
    expect(document.querySelector('[aria-roledescription]')!.getAttribute('aria-label')).not.toBe(before)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts a swipe for logged-in users (buttons and drag)', async () => {
    await renderDeck(true)
    fireEvent.click(screen.getByRole('button', { name: 'Mentem →' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/swipes')
    expect(JSON.parse(init.body)).toMatchObject({ direction: 'right' })

    const card = document.querySelector('[aria-roledescription]') as HTMLElement
    card.setPointerCapture = () => {}
    fireEvent.pointerDown(card, { pointerId: 1, clientX: 200, button: 0, pointerType: 'touch' })
    fireEvent.pointerMove(card, { pointerId: 1, clientX: 100, pointerType: 'touch' })
    fireEvent.pointerUp(card, { pointerId: 1, clientX: 50, pointerType: 'touch' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ direction: 'left' })
  })

  it('sends swipes one at a time and puts a card back when saving fails', async () => {
    let release!: () => void
    fetchMock
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ ok: false, status: 500 }))))
      .mockResolvedValue({ ok: true, status: 201 })
    await renderDeck(true)
    const card = () => document.querySelector('[aria-roledescription]')!.getAttribute('aria-label')
    const first = card()
    key('ArrowRight')
    key('ArrowLeft')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    // The second swipe waits for the first response.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => release())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('alert').textContent).toContain('Nem sikerült menteni')
    expect(screen.queryByText(/Elmentve/)).toBeNull()
    // The failed right swipe is back in the deck.
    expect(card()).toBe(first)
  })
})
