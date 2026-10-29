'use server'

import { getPayloadClient } from '@/components/payloadClient'

import { getPublishedArtist } from '../data'

export type ProfileRequestState =
  | { status: 'idle' }
  | { status: 'ok'; type: 'claim' | 'remove' }
  | { status: 'error'; message: string; fields?: { email?: string; type?: string; message?: string } }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_MESSAGE = 2000

/** Records a claim/remove request for a published artist. A curator handles it in the admin. */
export async function submitProfileRequest(
  _prev: ProfileRequestState,
  formData: FormData,
): Promise<ProfileRequestState> {
  const handle = String(formData.get('handle') ?? '')
  const email = String(formData.get('email') ?? '').trim()
  const type = String(formData.get('type') ?? '')
  const message = String(formData.get('message') ?? '').trim()
  const fields = { email, type, message }

  // Honeypot: people never see this field. Pretend success so bots learn nothing.
  if (String(formData.get('website') ?? '') !== '') {
    return { status: 'ok', type: type === 'remove' ? 'remove' : 'claim' }
  }

  if (type !== 'claim' && type !== 'remove') {
    return { status: 'error', message: 'Válaszd ki, mit szeretnél.', fields }
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { status: 'error', message: 'Adj meg egy érvényes e-mail-címet.', fields }
  }
  if (message.length > MAX_MESSAGE) {
    return { status: 'error', message: `Az üzenet legfeljebb ${MAX_MESSAGE} karakter lehet.`, fields }
  }

  const artist = await getPublishedArtist(handle)
  if (!artist) return { status: 'error', message: 'Ez a profil nem található.', fields }

  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'profile-requests',
      data: { artist: artist.id, type, email, message: message || undefined, status: 'open' },
      // Visitors cannot create profile requests through the API; only this action can.
      overrideAccess: true,
    })
  } catch (error) {
    const payload = await getPayloadClient()
    payload.logger.error({ err: error }, 'profile request failed')
    return { status: 'error', message: 'Nem sikerült elküldeni. Próbáld újra később.', fields }
  }

  return { status: 'ok', type }
}
