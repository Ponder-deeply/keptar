import type { CollectionAfterReadHook, CollectionBeforeOperationHook, CollectionConfig, Where } from 'payload'

import { anyone, isStaff, staffOnly } from '../access/roles'

/**
 * Visitors only see the published artists of an exhibition. Without this, the
 * `artists` relationship would expose hidden or pending artists' ids (depth 0).
 */
/** Drops `artists` / `artists.id` conditions from a where clause, recursively. */
const stripArtistIdFilters = (where: Where): Where =>
  Object.fromEntries(
    Object.entries(where)
      .filter(([key]) => key !== 'artists' && key !== 'artists.id')
      .map(([key, value]) =>
        (key === 'and' || key === 'or') && Array.isArray(value)
          ? [key, (value as Where[]).map(stripArtistIdFilters)]
          : [key, value],
      ),
  ) as Where

/**
 * ...and can't filter by artist id, which would confirm that an exhibition lists a
 * given unpublished artist. Paths through the relationship (`artists.handle`) are
 * already limited to readable artists by Payload.
 */
const noArtistIdFiltersForVisitors: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if ((operation === 'read' || operation === 'count') && !args.overrideAccess && !isStaff(req.user)) {
    if ('where' in args && args.where) args.where = stripArtistIdFilters(args.where)
  }
  return args
}

const hideUnpublishedArtists: CollectionAfterReadHook = async ({ doc, req, overrideAccess }) => {
  if (overrideAccess || isStaff(req.user) || !Array.isArray(doc.artists) || doc.artists.length === 0) return doc
  const ids = doc.artists.map((a: number | { id: number }) => (typeof a === 'object' ? a.id : a))
  const { docs } = await req.payload.find({
    collection: 'artists',
    where: { and: [{ id: { in: ids } }, { status: { equals: 'published' } }] },
    select: { status: true },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const published = new Set(docs.map((a) => a.id))
  doc.artists = doc.artists.filter((a: number | { id: number }) => published.has(typeof a === 'object' ? a.id : a))
  return doc
}

export const Exhibitions: CollectionConfig = {
  slug: 'exhibitions',
  labels: { singular: 'Kiállítás', plural: 'Kiállítások' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'venue', 'startDate', 'endDate'],
  },
  hooks: { beforeOperation: [noArtistIdFiltersForVisitors], afterRead: [hideUnpublishedArtists] },
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
