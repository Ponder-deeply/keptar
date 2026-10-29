'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

/** Main nav links; marks the current section with aria-current. */
export function SiteNavLinks({ links }: { links: readonly { href: string; label: string }[] }) {
  const pathname = usePathname()

  return (
    <ul>
      {links.map((link) => {
        const current = pathname === link.href || pathname.startsWith(`${link.href}/`)
        return (
          <li key={link.href}>
            <Link href={link.href} aria-current={current ? 'page' : undefined}>
              {link.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
