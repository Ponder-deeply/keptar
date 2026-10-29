'use client'

import React, { useState } from 'react'

/** Asks for an email and requests a magic link. `redirect` is where the link lands after login. */
export function MagicLinkForm({ redirect }: { redirect?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('sending')
    const email = new FormData(event.currentTarget).get('email')
    const res = await fetch('/api/users/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirect }),
    })
    setState(res.ok ? 'sent' : 'error')
  }

  if (state === 'sent') {
    return <p>Elküldtük a belépési linket. Nézd meg a postafiókodat.</p>
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">E-mail-cím</label>
      <input id="email" name="email" type="email" required autoComplete="email" />
      <button type="submit" disabled={state === 'sending'}>
        Belépési link küldése
      </button>
      {state === 'error' && <p>Nem sikerült elküldeni. Ellenőrizd a címet, és próbáld újra.</p>}
    </form>
  )
}
