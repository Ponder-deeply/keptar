import type { CollectionConfig } from 'payload'

import { anyone, staffOnly } from '../access/roles'
import { slugify } from '../fields/slugify'

// Medium / technique / subject vocabulary. A collection rather than fixed select
// options, so curators can grow the vocabulary without a schema change.
export const TAG_KINDS = [
  { label: 'Médium', value: 'medium' },
  { label: 'Technika', value: 'technique' },
  { label: 'Téma', value: 'subject' },
]

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Címke', plural: 'Címkék' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'slug'],
  },
  access: {
    read: anyone,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    { name: 'name', type: 'text', label: 'Név', required: true },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'URL-ben és szűrőkben használt azonosító. Üresen hagyva a névből készül.' },
      hooks: {
        beforeValidate: [({ value, data }) => value || (data?.name ? slugify(data.name) : value)],
      },
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Típus',
      required: true,
      options: TAG_KINDS,
      index: true,
    },
  ],
}
