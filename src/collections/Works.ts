import type { CollectionConfig } from 'payload'

import { isStaff, staffOnly } from '../access/roles'
import { IG_POST_URL_RE } from '../components/igPermalink'

export const Works: CollectionConfig = {
  slug: 'works',
  labels: { singular: 'Mű', plural: 'Művek' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'artist', 'source', 'updatedAt'],
  },
  access: {
    // Public visitors only see works of published artists.
    read: ({ req }) => (isStaff(req.user) ? true : { 'artist.status': { equals: 'published' } }),
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    {
      name: 'artist',
      type: 'relationship',
      label: 'Művész',
      relationTo: 'artists',
      required: true,
      index: true,
    },
    { name: 'title', type: 'text', label: 'Cím', admin: { description: 'Instagram posztnál elhagyható.' } },
    {
      name: 'source',
      type: 'select',
      label: 'Forrás',
      required: true,
      defaultValue: 'instagram',
      options: [
        { label: 'Instagram beágyazás', value: 'instagram' },
        { label: 'Feltöltött kép', value: 'upload' },
      ],
    },
    {
      name: 'igUrl',
      type: 'text',
      label: 'Instagram poszt URL',
      admin: { condition: (data) => data?.source === 'instagram' },
      validate: (value: string | null | undefined, { siblingData }: { siblingData: { source?: string } }) => {
        if (siblingData?.source !== 'instagram') return true
        if (!value) return 'Instagram posztnál kötelező.'
        return IG_POST_URL_RE.test(value) || 'Pl. https://www.instagram.com/p/ABC123/'
      },
    },
    {
      name: 'image',
      type: 'upload',
      label: 'Kép',
      relationTo: 'media',
      admin: { condition: (data) => data?.source === 'upload' },
      validate: (value: unknown, { siblingData }: { siblingData: { source?: string } }) =>
        siblingData?.source !== 'upload' || Boolean(value) || 'Feltöltött műnél kötelező.',
    },
    {
      name: 'tags',
      type: 'relationship',
      label: 'Címkék',
      relationTo: 'tags',
      hasMany: true,
      admin: { description: 'Az ajánlások a közös címkék alapján működnek.' },
    },
    { name: 'year', type: 'number', label: 'Év' },
    { name: 'dimensions', type: 'text', label: 'Méret' },
  ],
}
