import type { CollectionConfig } from 'payload'

import { adminOnly, adminOnlyField, hasRole, ROLES, staffOrOwner } from '../access/roles'
import { confirmMagicLink, requestMagicLink, verifyMagicLink } from '../endpoints/magicLink'

const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  admin: 'Adminisztrátor',
  curator: 'Kurátor',
  artist: 'Művész',
  user: 'Látogató',
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Felhasználó', plural: 'Felhasználók' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role', 'createdAt'],
  },
  auth: {
    // Visitors log in with a magic link (see endpoints below); staff may also use a password.
    tokenExpiration: 60 * 60 * 24 * 30,
    // HTTPS only in production (Caddy terminates TLS); plain http on localhost.
    cookies: { secure: process.env.NODE_ENV === 'production' },
  },
  access: {
    admin: ({ req }) => hasRole(req.user, 'admin', 'curator', 'artist'),
    // Self-signup happens only through the magic-link endpoint (overrideAccess).
    create: adminOnly,
    read: staffOrOwner('id'),
    update: ({ req }) => {
      if (hasRole(req.user, 'admin')) return true
      if (!req.user) return false
      return { id: { equals: req.user.id } }
    },
    delete: adminOnly,
  },
  hooks: {
    beforeOperation: [
      ({ args, operation, req }) => {
        // Only admins may change a login identity. Otherwise a visitor could move
        // their account onto someone else's unclaimed email and keep a password to it.
        // (Runs before Payload reads `password`, which happens ahead of other hooks.)
        if (operation === 'update' && !args.overrideAccess && !hasRole(req.user, 'admin') && args.data) {
          delete args.data.email
          delete args.data.password
        }
        return args
      },
    ],
  },
  endpoints: [
    { path: '/magic-link', method: 'post', handler: requestMagicLink },
    { path: '/magic-link/verify', method: 'get', handler: confirmMagicLink },
    { path: '/magic-link/verify', method: 'post', handler: verifyMagicLink },
  ],
  fields: [
    // Email added by default
    { name: 'name', type: 'text', label: 'Név' },
    {
      name: 'role',
      type: 'select',
      label: 'Szerepkör',
      required: true,
      defaultValue: 'user',
      saveToJWT: true,
      options: ROLES.map((value) => ({ label: ROLE_LABELS[value], value })),
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
      },
    },
    {
      name: 'saved',
      type: 'relationship',
      label: 'Mentett művek',
      relationTo: 'works',
      hasMany: true,
    },
    // Written only by the magic-link endpoint through payload.db, which skips access.
    {
      name: 'magicLinkHash',
      type: 'text',
      hidden: true,
      access: { create: () => false, read: () => false, update: () => false },
    },
    {
      name: 'magicLinkExpiresAt',
      type: 'date',
      hidden: true,
      access: { create: () => false, read: () => false, update: () => false },
    },
  ],
}
