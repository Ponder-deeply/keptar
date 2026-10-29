import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import './(site)/styles.css'

// With two root layouts ((site) and (payload)) Next needs a global 404 page.
export const metadata: Metadata = { title: 'Nincs ilyen oldal · Képtár' }

export default function GlobalNotFound() {
  return (
    <html lang="hu">
      <body>
        <main className="site-main">
          <h1>Nincs ilyen oldal</h1>
          <p>
            <Link href="/">Vissza a kezdőlapra</Link>
          </p>
        </main>
      </body>
    </html>
  )
}
