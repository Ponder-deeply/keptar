import type { CollectionConfig } from 'payload'

import { loggedIn, staffOrOwner } from '../access/roles'

// One swipe by a logged-in user. A right swipe also adds the work to `users.saved`.
// Anonymous visitors can swipe, but nothing is stored for them.
export const Swipes: CollectionConfig = {
  slug: 'swipes',
  labels: { singular: 'Swipe', plural: 'Swipe-ok' },
  admin: {
    defaultColumns: ['user', 'work', 'direction', 'createdAt'],
  },
  access: {
    read: staffOrOwner('user'),
    create: loggedIn,
    update: () => false,
    delete: staffOrOwner('user'),
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // A user can only swipe as themselves.
        if (operation === 'create' && req.user) data.user = req.user.id
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create' || doc.direction !== 'right') return doc
        const userId = typeof doc.user === 'object' ? doc.user.id : doc.user
        const workId = typeof doc.work === 'object' ? doc.work.id : doc.work
        const user = await req.payload.findByID({
          collection: 'users',
          id: userId,
          depth: 0,
          overrideAccess: true,
          req,
        })
        const saved = (user.saved ?? []).map((w) => (typeof w === 'object' ? w.id : w))
        if (!saved.includes(workId)) {
          await req.payload.update({
            collection: 'users',
            id: userId,
            data: { saved: [...saved, workId] },
            overrideAccess: true,
            req,
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'user', type: 'relationship', label: 'Felhasználó', relationTo: 'users', required: true, index: true },
    { name: 'work', type: 'relationship', label: 'Mű', relationTo: 'works', required: true, index: true },
    {
      name: 'direction',
      type: 'select',
      label: 'Irány',
      required: true,
      options: [
        { label: 'Balra (nem)', value: 'left' },
        { label: 'Jobbra (mentés)', value: 'right' },
      ],
    },
  ],
}
