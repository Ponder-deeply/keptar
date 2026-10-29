'use server'

import config from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'

import { errorSummary } from '@/lib/errors'
import { sendInquiryEmail, staffEmail } from '@/lib/mail'

import { findInquiryTarget } from './lookup'
import { allowInquiry, clientIp } from '@/lib/rateLimit'
import { isValidEmail } from '@/lib/validation'
import { HONEYPOT_FIELD, LIMITS, type InquiryFormState } from './shared'

const field = (formData: FormData, name: string): string => {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

/** Server action behind the "Érdeklődöm" form. */
export async function submitInquiry(
  _prev: InquiryFormState,
  formData: FormData,
): Promise<InquiryFormState> {
  // Honeypot: bots fill every field. Pretend success, store nothing.
  if (field(formData, HONEYPOT_FIELD)) return { status: 'sent' }

  const values = {
    senderName: field(formData, 'senderName'),
    senderEmail: field(formData, 'senderEmail'),
    message: field(formData, 'message'),
  }

  const fieldErrors: NonNullable<Extract<InquiryFormState, { status: 'error' }>['fieldErrors']> = {}
  if (values.senderName.length > LIMITS.nameMax) {
    fieldErrors.senderName = `Legfeljebb ${LIMITS.nameMax} karakter.`
  }
  if (!values.senderEmail) fieldErrors.senderEmail = 'Add meg az e-mail-címedet.'
  else if (!isValidEmail(values.senderEmail)) {
    fieldErrors.senderEmail = 'Ez nem tűnik érvényes e-mail-címnek.'
  }
  if (values.message.length < LIMITS.messageMin) {
    fieldErrors.message = `Az üzenet legalább ${LIMITS.messageMin} karakter legyen.`
  } else if (values.message.length > LIMITS.messageMax) {
    fieldErrors.message = `Az üzenet legfeljebb ${LIMITS.messageMax} karakter lehet.`
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Javítsd a megjelölt mezőket.', fieldErrors, values }
  }

  const payload = await getPayload({ config })
  const target = await findInquiryTarget(payload, formData.get('muvesz'), formData.get('mu'))
  if (!target) {
    return { status: 'error', message: 'Ez a művész nem található.', values }
  }

  if (!allowInquiry(clientIp(await headers()))) {
    return {
      status: 'error',
      message: 'Túl sok üzenetet küldtél rövid idő alatt. Próbáld újra később.',
      values,
    }
  }

  const { artist, work } = target
  let inquiry
  try {
    inquiry = await payload.create({
      collection: 'inquiries',
      data: {
        artist: artist.id,
        work: work?.id,
        senderName: values.senderName || undefined,
        senderEmail: values.senderEmail,
        message: values.message,
        delivered: false,
      },
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error({ err: errorSummary(err) }, 'Inquiry could not be saved')
    return { status: 'error', message: 'Nem sikerült elküldeni. Próbáld újra később.', values }
  }

  // Artists without an email (most imported ones) go to staff for forwarding, if configured.
  const to = artist.email || staffEmail()
  if (!to) {
    // Nobody is told about this inquiry; it only shows up in the admin.
    payload.logger.error(
      { inquiry: inquiry.id },
      'Inquiry has no recipient: the artist has no email and INQUIRY_FALLBACK_EMAIL is not set',
    )
    return { status: 'sent' }
  }
  try {
    await sendInquiryEmail(payload, {
      to,
      isFallback: !artist.email,
      artist: { name: artist.name, handle: artist.handle },
      work: work ? { id: work.id, title: work.title, igUrl: work.igUrl } : null,
      sender: { name: values.senderName, email: values.senderEmail },
      message: values.message,
    })
  } catch (err) {
    // The record stays with delivered: false so staff can follow up.
    payload.logger.error({ err, inquiry: inquiry.id }, 'Inquiry email failed')
    return { status: 'sent' }
  }
  // "Delivered" means it reached the artist, not the staff fallback inbox.
  if (artist.email) {
    try {
      await payload.update({
        collection: 'inquiries',
        id: inquiry.id,
        data: { delivered: true },
        overrideAccess: true,
      })
    } catch (err) {
      payload.logger.error({ err: errorSummary(err), inquiry: inquiry.id }, 'Inquiry was emailed, but marking it delivered failed')
    }
  }

  return { status: 'sent' }
}
