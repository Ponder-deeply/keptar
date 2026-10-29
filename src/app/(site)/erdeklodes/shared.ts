// Limits and state shared by the inquiry form (client) and its server action.

export const LIMITS = {
  nameMax: 100,
  emailMax: 254,
  messageMin: 10,
  messageMax: 3000,
} as const

/** Name of the hidden honeypot input. Real users leave it empty. */
export const HONEYPOT_FIELD = 'weboldal'

export type InquiryFormState =
  | { status: 'idle' }
  | { status: 'sent' }
  | {
      status: 'error'
      message: string
      fieldErrors?: Partial<Record<'senderName' | 'senderEmail' | 'message', string>>
      values?: { senderName: string; senderEmail: string; message: string }
    }
