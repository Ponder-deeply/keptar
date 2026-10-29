'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

/** Logs out through Payload's REST endpoint, then refreshes the server-rendered page. */
export function SiteNavLogout() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } finally {
      setPending(false)
      router.refresh()
    }
  }

  return (
    <button type="button" className="link-button" onClick={logout} disabled={pending}>
      Kilépés
    </button>
  )
}
