import type { CollectionConfig } from 'payload'

import { adminOnly, staffOnly } from '../access/roles'

// "Érdeklődöm" messages from visitors to an artist. Created server-side by the
// inquiry form (overrideAccess) and purged after 12 months by a scheduled job.
// Keep the data minimal: this is the GDPR basis (legitimate interest, stated retention).
export const INQUIRY_RETENTION_MONTHS = 12

export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  labels: { singular: 'Érdeklődés', plural: 'Érdeklődések' },
  admin: {
    useAsTitle: 'senderEmail',
    defaultColumns: ['artist', 'work', 'senderEmail', 'createdAt'],
    description: `Az érdeklődések ${INQUIRY_RETENTION_MONTHS} hónap után automatikusan törlődnek.`,
  },
  access: {
    read: staffOnly,
    create: () => false,
    update: () => false,
    delete: adminOnly,
  },
  fields: [
    { name: 'artist', type: 'relationship', label: 'Művész', relationTo: 'artists', required: true },
    { name: 'work', type: 'relationship', label: 'Mű', relationTo: 'works' },
    { name: 'senderName', type: 'text', label: 'Feladó neve' },
    { name: 'senderEmail', type: 'email', label: 'Feladó e-mail', required: true },
    { name: 'message', type: 'textarea', label: 'Üzenet', required: true },
    {
      name: 'delivered',
      type: 'checkbox',
      label: 'Kézbesítve a művésznek',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Hamis, ha a művésznek nincs e-mail-címe vagy a küldés hibázott.',
      },
    },
  ],
}
