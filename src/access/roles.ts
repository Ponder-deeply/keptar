import type { Access, FieldAccess, PayloadRequest } from 'payload'

export const ROLES = ['admin', 'curator', 'artist', 'user'] as const
export type Role = (typeof ROLES)[number]

type ReqUser = PayloadRequest['user']

export const hasRole = (user: ReqUser, ...roles: Role[]): boolean =>
  Boolean(user && 'role' in user && roles.includes(user.role as Role))

/** Admins and curators run the site's content. */
export const isStaff = (user: ReqUser): boolean => hasRole(user, 'admin', 'curator')

export const anyone: Access = () => true
export const loggedIn: Access = ({ req }) => Boolean(req.user)
export const adminOnly: Access = ({ req }) => hasRole(req.user, 'admin')
export const staffOnly: Access = ({ req }) => isStaff(req.user)

export const adminOnlyField: FieldAccess = ({ req }) => hasRole(req.user, 'admin')
export const staffOnlyField: FieldAccess = ({ req }) => isStaff(req.user)

/**
 * Payload's document locks. Staff see all; `artist` users (they can open the admin)
 * only their own, so the admin works for them; visitors none.
 */
export const adminUserLocks: Access = ({ req }) => {
  if (isStaff(req.user)) return true
  if (req.user && hasRole(req.user, 'artist')) return { 'user.value': { equals: req.user.id } }
  return false
}
export const canCreateLocks: Access = ({ req }) => hasRole(req.user, 'admin', 'curator', 'artist')

/** Staff see everything; other users only documents whose `field` points at them. */
export const staffOrOwner =
  (field: string): Access =>
  ({ req }) => {
    if (isStaff(req.user)) return true
    if (!req.user) return false
    return { [field]: { equals: req.user.id } }
  }
