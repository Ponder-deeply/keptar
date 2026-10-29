// Dev seed: `pnpm seed`. Wipes content collections and recreates fake data.
// Users are upserted, so existing accounts and their sessions survive a re-seed.
import sharp from 'sharp'
import { getPayload } from 'payload'

import config from './payload.config'

const payload = await getPayload({ config })

const CONTENT = [
  'swipes',
  'inquiries',
  'profile-requests',
  'exhibitions',
  'works',
  'artists',
  'venues',
  'tags',
  'media',
] as const

for (const collection of CONTENT) {
  await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true })
}

const upsertUser = async (email: string, password: string, role: 'admin' | 'curator' | 'user', name: string) => {
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1 })
  if (docs[0]) {
    return payload.update({ collection: 'users', id: docs[0].id, data: { role, name, password, saved: [] } })
  }
  return payload.create({ collection: 'users', data: { email, password, role, name } })
}

const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@keptar.local'
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'keptar-admin'
await upsertUser(adminEmail, adminPassword, 'admin', 'Admin')
await upsertUser('kurator@keptar.local', 'keptar-kurator', 'curator', 'Kurátor Teszt')
await upsertUser('latogato@keptar.local', 'keptar-latogato', 'user', 'Látogató Teszt')

const tagSpecs = [
  ['Festészet', 'medium'],
  ['Grafika', 'medium'],
  ['Szobrászat', 'medium'],
  ['Fotográfia', 'medium'],
  ['Kerámia', 'medium'],
  ['Olaj', 'technique'],
  ['Akril', 'technique'],
  ['Akvarell', 'technique'],
  ['Linómetszet', 'technique'],
  ['Bronzöntés', 'technique'],
  ['Analóg fotó', 'technique'],
  ['Korongozás', 'technique'],
  ['Tájkép', 'subject'],
  ['Portré', 'subject'],
  ['Absztrakt', 'subject'],
  ['Városi', 'subject'],
] as const

const tags: Record<string, number> = {}
for (const [name, kind] of tagSpecs) {
  const tag = await payload.create({ collection: 'tags', data: { name, kind, slug: '' } })
  tags[name] = tag.id
}

/** A flat-colour placeholder "artwork", so upload works render without real images. */
const placeholder = async (alt: string, hue: number) => {
  const [r, g, b] = hslToRgb(hue, 0.45, 0.55)
  const data = await sharp({
    create: { width: 1200, height: 1500, channels: 3, background: { r, g, b } },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
  return payload.create({
    collection: 'media',
    data: { alt },
    file: { data, mimetype: 'image/jpeg', name: `seed-${hue}.jpg`, size: data.length },
  })
}

type ArtistSpec = {
  handle: string
  name: string
  status: 'published' | 'pending'
  region: string
  city: string
  bio: string
  medium: string[]
  technique: string[]
  subjects: string[]
  email?: string
}

const artists: ArtistSpec[] = [
  {
    handle: 'teszt.kovacs.anna',
    name: 'Kovács Anna (teszt)',
    status: 'published',
    region: 'budapest',
    city: 'Budapest',
    bio: 'Nagyméretű olajfestmények a városi fényről.',
    medium: ['Festészet'],
    technique: ['Olaj'],
    subjects: ['Városi', 'Absztrakt'],
    email: 'kovacs.anna@example.com',
  },
  {
    handle: 'teszt.nagy.bence',
    name: 'Nagy Bence (teszt)',
    status: 'published',
    region: 'baranya',
    city: 'Pécs',
    bio: 'Linómetszetek és szitanyomatok a Mecsek tájairól.',
    medium: ['Grafika'],
    technique: ['Linómetszet'],
    subjects: ['Tájkép'],
    email: 'nagy.bence@example.com',
  },
  {
    handle: 'teszt.szabo.reka',
    name: 'Szabó Réka (teszt)',
    status: 'published',
    region: 'hajdu-bihar',
    city: 'Debrecen',
    bio: 'Korongozott és rakuégetett kerámiák.',
    medium: ['Kerámia'],
    technique: ['Korongozás'],
    subjects: ['Absztrakt'],
  },
  {
    handle: 'teszt.toth.mate',
    name: 'Tóth Máté (teszt)',
    status: 'published',
    region: 'csongrad-csanad',
    city: 'Szeged',
    bio: 'Analóg fekete-fehér portrék.',
    medium: ['Fotográfia'],
    technique: ['Analóg fotó'],
    subjects: ['Portré', 'Városi'],
    email: 'toth.mate@example.com',
  },
  {
    handle: 'teszt.horvath.lili',
    name: 'Horváth Lili (teszt)',
    status: 'published',
    region: 'kulfold',
    city: 'Bécs',
    bio: 'Akvarell tájképek a Fertő-tó környékéről.',
    medium: ['Festészet'],
    technique: ['Akvarell', 'Akril'],
    subjects: ['Tájkép'],
  },
  {
    handle: 'teszt.varga.peter',
    name: 'Varga Péter (teszt)',
    status: 'pending',
    region: 'gyor-moson-sopron',
    city: 'Győr',
    bio: 'Bronzszobrok. (Importált, átnézésre vár.)',
    medium: ['Szobrászat'],
    technique: ['Bronzöntés'],
    subjects: ['Portré'],
  },
]

const artistIds: number[] = []
let hue = 0
for (const [i, spec] of artists.entries()) {
  const artist = await payload.create({
    collection: 'artists',
    data: {
      handle: spec.handle,
      name: spec.name,
      status: spec.status,
      region: spec.region as never,
      city: spec.city,
      bio: spec.bio,
      email: spec.email,
      medium: spec.medium.map((t) => tags[t]),
      technique: spec.technique.map((t) => tags[t]),
    },
  })
  artistIds.push(artist.id)
  const workTags = [...spec.medium, ...spec.technique, ...spec.subjects].map((t) => tags[t])

  // Three uploaded works and one Instagram embed per artist.
  for (let n = 1; n <= 3; n++) {
    hue = (hue + 47) % 360
    const image = await placeholder(`${spec.name}: Mű ${n}`, hue)
    await payload.create({
      collection: 'works',
      data: {
        artist: artist.id,
        title: `Mű ${n}`,
        source: 'upload',
        image: image.id,
        tags: workTags,
        year: 2020 + n,
      },
    })
  }
  await payload.create({
    collection: 'works',
    data: {
      artist: artist.id,
      title: 'Instagram poszt (teszt URL)',
      source: 'instagram',
      // Fake shortcode: the embed will not resolve, but the URL shape is valid.
      igUrl: `https://www.instagram.com/p/TESZT${i}POSZT/`,
      tags: workTags,
    },
  })
}

const venues = [
  { name: 'Teszt Galéria', type: 'gallery', city: 'Budapest', address: 'Király utca 1.', lat: 47.4979, lng: 19.0402 },
  { name: 'Teszt Műhely', type: 'studio', city: 'Pécs', address: 'Széchenyi tér 1.', lat: 46.0727, lng: 18.2323 },
  { name: 'Teszt Múzeum', type: 'museum', city: 'Szeged', address: 'Dóm tér 1.', lat: 46.2530, lng: 20.1414 },
] as const

const venueIds: number[] = []
for (const v of venues) {
  const venue = await payload.create({ collection: 'venues', data: { ...v } })
  venueIds.push(venue.id)
}

const day = 24 * 60 * 60 * 1000
await payload.create({
  collection: 'exhibitions',
  data: {
    title: 'Városi fények',
    venue: venueIds[0],
    artists: [artistIds[0], artistIds[3]],
    startDate: new Date(Date.now() - 7 * day).toISOString(),
    endDate: new Date(Date.now() + 21 * day).toISOString(),
    description: 'Csoportos teszt kiállítás.',
  },
})
await payload.create({
  collection: 'exhibitions',
  data: {
    title: 'Mecseki lenyomatok',
    venue: venueIds[1],
    artists: [artistIds[1]],
    startDate: new Date(Date.now() + 14 * day).toISOString(),
    endDate: new Date(Date.now() + 45 * day).toISOString(),
  },
})

payload.logger.info(
  `Seed done: ${artists.length} artists, ${artists.length * 4} works, ${venues.length} venues. Admin: ${adminEmail} / ${adminPassword}`,
)
process.exit(0)

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as [number, number, number]
}
