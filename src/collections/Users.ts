import type { CollectionConfig } from 'payload'

import { adminOnly, adminOnlyField, hasRole, ROLES, staffOrOwner } from '../access/roles'
import { requestMagicLink, verifyMagicLink } from '../endpoints/magicLink'

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
  endpoints: [
    { path: '/magic-link', method: 'post', handler: requestMagicLink },
    { path: '/magic-link/verify', method: 'get', handler: verifyMagicLink },
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
    {
      name: 'magicLinkHash',
      type: 'text',
      hidden: true,
    },
    {
      name: 'magicLinkExpiresAt',
      type: 'date',
      hidden: true,
    },
  ],
}
