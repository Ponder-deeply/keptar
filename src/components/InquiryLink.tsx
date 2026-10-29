import Link from 'next/link'
import React from 'react'

import { inquiryHref } from './format'

/** "Érdeklődöm" link to the inquiry form, for an artist or one of their works. */
export function InquiryLink({ handle, workId, className }: { handle: string; workId?: number; className?: string }) {
  return (
    <Link href={inquiryHref(handle, workId)} className={['button', className].filter(Boolean).join(' ')}>
      Érdeklődöm
    </Link>
  )
}
