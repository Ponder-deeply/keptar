'use client'

import React, { useActionState } from 'react'

import { submitInquiry } from './actions'
import styles from './erdeklodes.module.css'
import { HONEYPOT_FIELD, LIMITS, type InquiryFormState } from './shared'

const initialState: InquiryFormState = { status: 'idle' }

export function InquiryForm({ handle, workId }: { handle: string; workId?: number }) {
  const [state, formAction, pending] = useActionState(submitInquiry, initialState)

  if (state.status === 'sent') {
    return (
      <p className={styles.success} role="status">
        Köszönjük! Az üzenetedet továbbítjuk a művésznek, aki közvetlenül neked válaszol.
      </p>
    )
  }

  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {}
  const values = state.status === 'error' ? state.values : undefined

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="muvesz" value={handle} />
      {workId !== undefined && <input type="hidden" name="mu" value={String(workId)} />}

      {state.status === 'error' && (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor="senderName">Neved (nem kötelező)</label>
        <input
          id="senderName"
          name="senderName"
          type="text"
          autoComplete="name"
          maxLength={LIMITS.nameMax}
          defaultValue={values?.senderName}
          aria-invalid={Boolean(errors.senderName) || undefined}
          aria-describedby={errors.senderName ? 'senderName-error' : undefined}
        />
        {errors.senderName && (
          <span id="senderName-error" className={styles.fieldError}>
            {errors.senderName}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="senderEmail">E-mail-címed</label>
        <input
          id="senderEmail"
          name="senderEmail"
          type="email"
          required
          autoComplete="email"
          maxLength={LIMITS.emailMax}
          defaultValue={values?.senderEmail}
          aria-invalid={Boolean(errors.senderEmail) || undefined}
          aria-describedby={errors.senderEmail ? 'senderEmail-error' : undefined}
        />
        {errors.senderEmail && (
          <span id="senderEmail-error" className={styles.fieldError}>
            {errors.senderEmail}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="message">Üzenet</label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          minLength={LIMITS.messageMin}
          maxLength={LIMITS.messageMax}
          defaultValue={values?.message}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={errors.message ? 'message-error message-hint' : 'message-hint'}
        />
        <span id="message-hint" className={styles.hint}>
          {LIMITS.messageMin}–{LIMITS.messageMax} karakter.
        </span>
        {errors.message && (
          <span id="message-error" className={styles.fieldError}>
            {errors.message}
          </span>
        )}
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={HONEYPOT_FIELD}>Weboldal</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p className={styles.privacy}>
        Az üzenetedet továbbítjuk a művésznek. Az adataidat csak ehhez használjuk, és 12 hónap után
        töröljük.
      </p>

      <button type="submit" disabled={pending}>
        {pending ? 'Küldés…' : 'Üzenet küldése'}
      </button>
    </form>
  )
}
