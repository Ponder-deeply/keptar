import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

// Placeholder home page; the real one comes with the public pages (Wave 2).
export default async function HomePage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers })

  return (
    <div className="home">
      <div className="content">
        <h1>Képtár</h1>
        <p>Kortárs magyar képzőművészek.</p>
        {user ? <p>Bejelentkezve: {user.email}</p> : <Link href="/belepes">Belépés</Link>}
      </div>
    </div>
  )
}
