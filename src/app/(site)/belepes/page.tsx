import type { Metadata } from 'next'
import React from 'react'

import { MagicLinkForm } from './MagicLinkForm'

export const metadata: Metadata = { title: 'Belépés' }

export default async function LoginPage(props: {
  searchParams: Promise<{ hiba?: string; vissza?: string }>
}) {
  const { hiba, vissza } = await props.searchParams

  return (
    <>
      <h1>Belépés</h1>
      <p className="intro">
        Add meg az e-mail-címedet, és küldünk egy belépési linket. Jelszó nem kell.
      </p>
      {hiba && (
        <p className="form-error" role="alert">
          A link lejárt vagy már felhasználták. Kérj újat.
        </p>
      )}
      <MagicLinkForm redirect={vissza} />
    </>
  )
}
