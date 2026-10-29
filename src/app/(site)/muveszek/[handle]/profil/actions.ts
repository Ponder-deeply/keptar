'use server'

import { headers } from 'next/headers'

import { getPayloadClient } from '@/components/payloadClient'
import { sendProfileRequestEmail, staffEmail } from '@/lib/mail'
import { allowProfileRequest, clientIp } from '@/lib/rateLimit'
import { isValidEmail } from '@/lib/validation'

import { getPublishedArtist } from '../data'

export type ProfileRequestState =
  | { status: 'idle' }
  | { status: 'ok'; type: 'claim' | 'remove' }
  | { status: 'error'; message: string; fields?: { email?: string; type?: string; message?: string } }

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
  if (!isValidEmail(email)) {
    return { status: 'error', message: 'Adj meg egy érvényes e-mail-címet.', fields }
  }
  if (message.length > MAX_MESSAGE) {
    return { status: 'error', message: `Az üzenet legfeljebb ${MAX_MESSAGE} karakter lehet.`, fields }
  }

  const artist = await getPublishedArtist(handle)
  if (!artist) return { status: 'error', message: 'Ez a profil nem található.', fields }

  if (!allowProfileRequest(clientIp(await headers()))) {
    return { status: 'error', message: 'Túl sok kérést küldtél rövid idő alatt. Próbáld újra később.', fields }
  }

  const payload = await getPayloadClient()
  try {
    await payload.create({
      collection: 'profile-requests',
      data: { artist: artist.id, type, email, message: message || undefined, status: 'open' },
      // Visitors cannot create profile requests through the API; only this action can.
      overrideAccess: true,
    })
  } catch (error) {
    payload.logger.error({ err: error }, 'profile request failed')
    return { status: 'error', message: 'Nem sikerült elküldeni. Próbáld újra később.', fields }
  }

  // The request is stored either way; the email only makes sure a curator sees it soon.
  const to = staffEmail()
  if (to) {
    try {
      await sendProfileRequestEmail(payload, {
        to,
        type,
        artist: { name: artist.name, handle: artist.handle },
        email,
        message: message || undefined,
      })
    } catch (error) {
      payload.logger.error({ err: error }, 'profile request email failed')
    }
  } else {
    payload.logger.error('Profile request stored, but INQUIRY_FALLBACK_EMAIL is not set, so no curator was told')
  }

  return { status: 'ok', type }
}
