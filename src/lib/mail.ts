import type { Payload } from 'payload'
import { serverURL } from './serverURL'
import { escapeHtml } from './validation'

export type InquiryEmailInput = {
  /** Where the email goes: the artist, or the staff fallback address. */
  to: string
  /** True when `to` is the staff fallback, not the artist (adds a forwarding note). */
  isFallback?: boolean
  artist: { name: string; handle: string }
  work?: { id: number | string; title?: string | null; igUrl?: string | null } | null
  sender: { name?: string | null; email: string }
  message: string
}

/** Public profile URL of an artist (route built by the public pages). */
export const artistProfileURL = (handle: string): string =>
  `${serverURL()}/muveszek/${encodeURIComponent(handle)}`

const workLabel = (work: InquiryEmailInput['work']): string | null => {
  if (!work) return null
  return work.title?.trim() || `#${work.id}`
}

/** Staff inbox for things someone has to act on, from INQUIRY_FALLBACK_EMAIL. */
export const staffEmail = (): string | undefined => process.env.INQUIRY_FALLBACK_EMAIL?.trim() || undefined

/** Tells staff about a new claim/remove request. Throws if the adapter fails. */
export async function sendProfileRequestEmail(
  payload: Payload,
  input: { to: string; type: 'claim' | 'remove'; artist: { name: string; handle: string }; email: string; message?: string },
): Promise<void> {
  const { to, type, artist, email, message } = input
  const action = type === 'remove' ? 'eltávolítását kéri' : 'magáénak jelöli'
  const text = [
    `${email} a(z) ${artist.name} (@${artist.handle}) profil ${action}.`,
    ...(message ? ['', 'Üzenet:', message] : []),
    '',
    `Profil: ${artistProfileURL(artist.handle)}`,
    `Kezelés az adminban: ${serverURL()}/admin/collections/profile-requests`,
  ].join('\n')
  await payload.sendEmail({
    to,
    replyTo: email,
    subject: `Profilkérés (${type === 'remove' ? 'eltávolítás' : 'átvétel'}): @${artist.handle}`,
    text,
  })
}

const PRIVACY_FOOTER =
  'Az üzenetet csak továbbítjuk; a feladó adatait 12 hónap után töröljük, és másra nem használjuk.'

/**
 * Sends an "Érdeklődöm" message to the artist via `payload.sendEmail` (Resend in
 * production, the console adapter in dev). `replyTo` is the sender, so the artist
 * answers them directly. Throws if the adapter fails; the caller decides `delivered`.
 */
export async function sendInquiryEmail(payload: Payload, input: InquiryEmailInput): Promise<void> {
  const { to, isFallback, artist, work, sender, message } = input
  const profileURL = artistProfileURL(artist.handle)
  const senderName = sender.name?.trim()
  const senderLabel = senderName ? `${senderName} <${sender.email}>` : sender.email
  const label = workLabel(work)
  const subject = label ? `Érdeklődés: ${label} (Képtár)` : 'Érdeklődés a Képtáron keresztül'
  const fallbackNote = `Továbbítandó: ${artist.name} (@${artist.handle}) művésznek nincs megadott e-mail-címe.`

  const text = [
    ...(isFallback ? [`[${fallbackNote}]`, ''] : []),
    `Kedves ${artist.name}!`,
    '',
    `${senderLabel} érdeklődik a Képtáron keresztül${label ? ` a következő mű iránt: ${label}` : ''}.`,
    ...(work?.igUrl ? [`A mű: ${work.igUrl}`] : []),
    '',
    'Üzenet:',
    message,
    '',
    'Válaszolj erre az e-mailre, és a válaszod közvetlenül a feladóhoz kerül.',
    '',
    `A profilod: ${profileURL}`,
    '',
    '--',
    'Képtár · kortárs magyar képzőművészek',
    PRIVACY_FOOTER,
  ].join('\n')

  const workHtml = label ? ` a következő mű iránt: <strong>${escapeHtml(label)}</strong>` : ''
  const workLinkHtml = work?.igUrl ? ` <a href="${escapeHtml(work.igUrl)}">A mű megtekintése</a>` : ''
  const html = [
    '<!doctype html><html lang="hu"><body style="font-family:sans-serif;line-height:1.5;">',
    isFallback ? `<p style="padding:8px;background:#fff3cd;"><strong>${escapeHtml(fallbackNote)}</strong></p>` : '',
    `<p>Kedves ${escapeHtml(artist.name)}!</p>`,
    `<p><strong>${escapeHtml(senderLabel)}</strong> érdeklődik a Képtáron keresztül${workHtml}.${workLinkHtml}</p>`,
    `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #ccc;white-space:pre-wrap;">${escapeHtml(message)}</blockquote>`,
    '<p>Válaszolj erre az e-mailre, és a válaszod közvetlenül a feladóhoz kerül.</p>',
    `<p><a href="${escapeHtml(profileURL)}">A profilod a Képtáron</a></p>`,
    '<hr>',
    `<p style="font-size:12px;color:#666;">Képtár · kortárs magyar képzőművészek. ${PRIVACY_FOOTER}</p>`,
    '</body></html>',
  ].join('\n')

  await payload.sendEmail({ to, replyTo: sender.email, subject, text, html })
}
