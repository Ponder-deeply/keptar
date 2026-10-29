import type { CollectionConfig } from 'payload'

import { anyone, staffOnly } from '../access/roles'

export const Venues: CollectionConfig = {
  slug: 'venues',
  labels: { singular: 'Helyszín', plural: 'Helyszínek' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'city'],
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
      name: 'type',
      type: 'select',
      label: 'Típus',
      required: true,
      options: [
        { label: 'Galéria', value: 'gallery' },
        { label: 'Múzeum', value: 'museum' },
        { label: 'Műterem', value: 'studio' },
        { label: 'Kulturális központ', value: 'cultural-centre' },
        { label: 'Egyéb', value: 'other' },
      ],
    },
    { name: 'address', type: 'text', label: 'Cím' },
    { name: 'city', type: 'text', label: 'Város' },
    {
      type: 'row',
      fields: [
        { name: 'lat', type: 'number', label: 'Szélesség (lat)', required: true, min: -90, max: 90 },
        { name: 'lng', type: 'number', label: 'Hosszúság (lng)', required: true, min: -180, max: 180 },
      ],
    },
    { name: 'website', type: 'text', label: 'Weboldal' },
  ],
}
