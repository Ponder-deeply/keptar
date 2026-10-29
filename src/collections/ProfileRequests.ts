import type { CollectionConfig } from 'payload'

import { staffOnly } from '../access/roles'

// "Ez az én profilom / távolítsd el": an artist asks to claim or remove their
// imported profile. Created server-side (overrideAccess); a curator reviews it and
// sets the artist to hidden or links `claimedBy`.
export const ProfileRequests: CollectionConfig = {
  slug: 'profile-requests',
  labels: { singular: 'Profilkérés', plural: 'Profilkérések' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['artist', 'type', 'email', 'status', 'createdAt'],
  },
  access: {
    read: staffOnly,
    create: () => false,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'artist', type: 'relationship', label: 'Művész', relationTo: 'artists', required: true },
    {
      name: 'type',
      type: 'select',
      label: 'Kérés',
      required: true,
      options: [
        { label: 'Ez az én profilom', value: 'claim' },
        { label: 'Távolítsd el', value: 'remove' },
      ],
    },
    { name: 'email', type: 'email', label: 'E-mail', required: true },
    { name: 'message', type: 'textarea', label: 'Üzenet' },
    {
      name: 'status',
      type: 'select',
      label: 'Állapot',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Nyitott', value: 'open' },
        { label: 'Elintézve', value: 'done' },
        { label: 'Elutasítva', value: 'rejected' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
