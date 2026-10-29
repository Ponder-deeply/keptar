import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import React from 'react'

import { getPayloadClient } from './payloadClient'
import { SiteNavLinks } from './SiteNavLinks'
import { SiteNavLogout } from './SiteNavLogout'

export const NAV_LINKS = [
  { href: '/muveszek', label: 'Művészek' },
  { href: '/felfedezes', label: 'Felfedezés' },
  { href: '/mentett', label: 'Mentett' },
  { href: '/kiallitasok', label: 'Kiállítások' },
  { href: '/helyszinek', label: 'Helyszínek' },
] as const

/** Site header: logo, main links, and login state. */
export async function SiteNav() {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await getHeaders() })

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-logo">
          Képtár
        </Link>
        <nav aria-label="Fő navigáció" className="site-nav">
          <SiteNavLinks links={NAV_LINKS} />
        </nav>
        <div className="site-account">
          {user ? (
            <>
              <span className="site-account__email">{user.email}</span>
              <SiteNavLogout />
            </>
          ) : (
            <Link href="/belepes">Belépés</Link>
          )}
        </div>
      </div>
    </header>
  )
}
