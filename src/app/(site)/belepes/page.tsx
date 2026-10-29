import React from 'react'

import { MagicLinkForm } from './MagicLinkForm'

export const metadata = { title: 'Belépés · Képtár' }

export default async function LoginPage(props: {
  searchParams: Promise<{ hiba?: string; vissza?: string }>
}) {
  const { hiba, vissza } = await props.searchParams

  return (
    <div className="home">
      <div className="content">
        <h1>Belépés</h1>
        {hiba && <p>A link lejárt vagy már felhasználták. Kérj újat.</p>}
        <MagicLinkForm redirect={vissza} />
      </div>
    </div>
  )
}
