import type { CollectionConfig } from 'payload'

import { isStaff, staffOnly, staffOnlyField } from '../access/roles'
import { REGIONS } from '../fields/regions'
import { isValidHandle, normalizeHandle } from '../lib/validation'

export const ARTIST_STATUSES = [
  // Imported from the Instagram following list, not yet reviewed by the curator.
  { label: 'Átnézésre vár', value: 'pending' },
  { label: 'Publikus', value: 'published' },
  // Not an artist (the following list contains friends, brands, etc.).
  { label: 'Elutasítva', value: 'rejected' },
  // Opted out via the "remove my profile" link.
  { label: 'Elrejtve', value: 'hidden' },
]

export const Artists: CollectionConfig = {
  slug: 'artists',
  labels: { singular: 'Művész', plural: 'Művészek' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'handle', 'status', 'region', 'updatedAt'],
    listSearchableFields: ['name', 'handle'],
  },
  access: {
    read: ({ req }) => (isStaff(req.user) ? true : { status: { equals: 'published' } }),
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    {
      name: 'handle',
      type: 'text',
      label: 'Instagram név',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'A @ nélkül, pl. "kovacs.anna.art". Ez a profil URL-je is.' },
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? normalizeHandle(value) : value)],
      },
      // The public routes only accept valid Instagram names, so anything else would 404.
      validate: (value: string | null | undefined) =>
        (typeof value === 'string' && isValidHandle(value)) ||
        'Csak kisbetű, szám, pont és alulvonás, legfeljebb 30 karakter (pl. kovacs.anna.art).',
    },
    { name: 'name', type: 'text', label: 'Név', required: true },
    {
      name: 'status',
      type: 'select',
      label: 'Állapot',
      required: true,
      defaultValue: 'pending',
      options: ARTIST_STATUSES,
      index: true,
      admin: { position: 'sidebar' },
    },
    { name: 'bio', type: 'textarea', label: 'Rövid bemutatkozás' },
    {
      name: 'medium',
      type: 'relationship',
      label: 'Médium',
      relationTo: 'tags',
      hasMany: true,
      filterOptions: { kind: { equals: 'medium' } },
    },
    {
      name: 'technique',
      type: 'relationship',
      label: 'Technika',
      relationTo: 'tags',
      hasMany: true,
      filterOptions: { kind: { equals: 'technique' } },
    },
    { name: 'region', type: 'select', label: 'Régió', options: REGIONS, index: true },
    { name: 'city', type: 'text', label: 'Város' },
    { name: 'website', type: 'text', label: 'Weboldal' },
    {
      name: 'email',
      type: 'email',
      label: 'E-mail (érdeklődésekhez)',
      admin: { description: 'Nem jelenik meg a nyilvános oldalon.' },
      access: { read: staffOnlyField },
    },
    {
      name: 'aiTagged',
      type: 'checkbox',
      label: 'MI által javasolt címkék',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'A címkéző szkript állítja be. Ellenőrzés után vedd ki a pipát.',
      },
    },
    {
      name: 'claimedBy',
      type: 'relationship',
      label: 'Profil gazdája',
      relationTo: 'users',
      admin: { position: 'sidebar' },
      access: { read: staffOnlyField },
    },
    {
      name: 'curatorNotes',
      type: 'textarea',
      label: 'Kurátori jegyzet',
      admin: { position: 'sidebar' },
      access: { read: staffOnlyField },
    },
    {
      name: 'works',
      type: 'join',
      label: 'Művek',
      collection: 'works',
      on: 'artist',
    },
  ],
}
