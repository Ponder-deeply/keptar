import type { Metadata } from 'next'
import React from 'react'

import { SiteNav } from '@/components/SiteNav'

import './styles.css'

export const metadata: Metadata = {
  description: 'Kortárs magyar képzőművészek bemutató oldala.',
  title: { default: 'Képtár', template: '%s · Képtár' },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="hu">
      <body>
        <a href="#tartalom" className="skip-link">
          Ugrás a tartalomra
        </a>
        <SiteNav />
        <main id="tartalom" className="site-main">
          {children}
        </main>
        <footer className="site-footer">
          <p>
            Képtár: nonprofit bemutató oldal kortárs magyar képzőművészeknek. A művek a művészeké;
            minden poszt az eredeti Instagram-oldalra mutat.
          </p>
        </footer>
      </body>
    </html>
  )
}
