'use client'

import React, { useActionState } from 'react'

import { submitProfileRequest, type ProfileRequestState } from './actions'

const initialState: ProfileRequestState = { status: 'idle' }

export function ProfileRequestForm({ handle }: { handle: string }) {
  const [state, formAction, pending] = useActionState(submitProfileRequest, initialState)

  if (state.status === 'ok') {
    return (
      <div className="notice" role="status">
        <p>
          Köszönjük, megkaptuk a kérésedet.{' '}
          {state.type === 'remove'
            ? 'A kurátor átnézi, elrejti a profilt, és e-mailben visszajelez.'
            : 'A kurátor e-mailben felveszi veled a kapcsolatot, hogy igazolja, a profil a tiéd.'}
        </p>
      </div>
    )
  }

  const fields = state.status === 'error' ? state.fields : undefined

  return (
    <form action={formAction} className="form">
      <input type="hidden" name="handle" value={handle} />

      <fieldset>
        <legend>Mit szeretnél?</legend>
        <label className="radio">
          <input type="radio" name="type" value="claim" required defaultChecked={fields?.type !== 'remove'} />
          Ez az én profilom, szeretném kezelni
        </label>
        <label className="radio">
          <input type="radio" name="type" value="remove" defaultChecked={fields?.type === 'remove'} />
          Távolítsátok el a profilomat
        </label>
      </fieldset>

      <div>
        <label htmlFor="pr-email">E-mail-cím</label>
        <input
          id="pr-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={fields?.email}
          aria-describedby="pr-email-hint"
        />
        <p id="pr-email-hint" className="form-hint">
          Csak a kérés intézéséhez használjuk.
        </p>
      </div>

      <div>
        <label htmlFor="pr-message">Üzenet (nem kötelező)</label>
        <textarea id="pr-message" name="message" rows={4} maxLength={2000} defaultValue={fields?.message} />
      </div>

      {/* Honeypot against bots; hidden from people and screen readers. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="pr-website">Weboldal</label>
        <input id="pr-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      <div>
        <button type="submit" disabled={pending}>
          {pending ? 'Küldés…' : 'Kérés elküldése'}
        </button>
      </div>
    </form>
  )
}
