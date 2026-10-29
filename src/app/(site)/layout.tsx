import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Kortárs magyar képzőművészek bemutató oldala.',
  title: 'Képtár',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="hu">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
