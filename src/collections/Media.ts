import type { CollectionConfig } from 'payload'

import { anyone, staffOnly } from '../access/roles'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Kép', plural: 'Képek' },
  access: {
    read: anyone,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alternatív szöveg',
      required: true,
    },
  ],
  upload: {
    imageSizes: [
      { name: 'thumb', width: 400 },
      { name: 'large', width: 1600 },
    ],
  },
}
