import Link from 'next/link'
import React from 'react'

export default function ArtistNotFound() {
  return (
    <>
      <h1>Nincs ilyen művész</h1>
      <p>Ez a profil nem létezik, vagy jelenleg nem nyilvános.</p>
      <p>
        <Link href="/muveszek">Vissza a művészekhez</Link>
      </p>
    </>
  )
}
