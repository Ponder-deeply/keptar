import type { Access, CollectionConfig } from 'payload'

import { isStaff, staffOnly } from '../access/roles'

/**
 * The public may only read images used by a published artist's work or by an
 * exhibition, so hidden/pending artists' images (and their alt texts) stay private.
 * One extra query per request; fine at this site's scale.
 */
const readPublicMedia: Access = async ({ req }) => {
  if (isStaff(req.user)) return true
  const [works, exhibitions] = await Promise.all([
    req.payload.find({
      collection: 'works',
      where: { and: [{ source: { equals: 'upload' } }, { 'artist.status': { equals: 'published' } }] },
      select: { image: true },
      depth: 0,
      pagination: false,
      req,
    }),
    req.payload.find({
      collection: 'exhibitions',
      where: { image: { exists: true } },
      select: { image: true },
      depth: 0,
      pagination: false,
      req,
    }),
  ])
  const ids = [...works.docs, ...exhibitions.docs]
    .map((doc) => (typeof doc.image === 'object' ? doc.image?.id : doc.image))
    .filter((id): id is number => typeof id === 'number')
  return { id: { in: ids } }
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Kép', plural: 'Képek' },
  access: {
    read: readPublicMedia,
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
