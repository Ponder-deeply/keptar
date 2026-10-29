'use server'

import { headers as getHeaders } from 'next/headers.js'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'

import config from '@/payload.config'

/** Removes one work from the logged-in user's saved list. */
export async function removeSaved(formData: FormData): Promise<void> {
  const workId = Number(formData.get('work'))
  if (!Number.isInteger(workId) || workId <= 0) return

  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user) return

  // Re-read the current list so concurrent saves (e.g. from another tab) are kept.
  const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: false, user })
  const saved = (fresh.saved ?? []).map((w) => (typeof w === 'object' ? w.id : w))
  if (!saved.includes(workId)) return

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { saved: saved.filter((id) => id !== workId) },
    overrideAccess: false,
    user,
  })
  revalidatePath('/mentett')
}
