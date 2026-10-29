import type { CollectionConfig } from 'payload'

import { anyone, staffOnly } from '../access/roles'

export const Exhibitions: CollectionConfig = {
  slug: 'exhibitions',
  labels: { singular: 'Kiállítás', plural: 'Kiállítások' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'venue', 'startDate', 'endDate'],
  },
  access: {
    read: anyone,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'title', type: 'text', label: 'Cím', required: true },
    { name: 'venue', type: 'relationship', label: 'Helyszín', relationTo: 'venues', required: true },
    { name: 'artists', type: 'relationship', label: 'Művészek', relationTo: 'artists', hasMany: true },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'date', label: 'Kezdés', required: true, index: true },
        { name: 'endDate', type: 'date', label: 'Vége' },
      ],
    },
    { name: 'description', type: 'textarea', label: 'Leírás' },
    {
      name: 'url',
      type: 'text',
      label: 'Link (pl. Facebook esemény)',
    },
    { name: 'image', type: 'upload', label: 'Kép', relationTo: 'media' },
  ],
}
