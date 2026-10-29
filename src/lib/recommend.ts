import type { Payload } from 'payload'

import type { User, Work } from '@/payload-types'

type Rel<T extends { id: number }> = number | T | null | undefined

const relId = <T extends { id: number }>(rel: Rel<T>): number | null =>
  rel == null ? null : typeof rel === 'object' ? rel.id : rel

const relIds = <T extends { id: number }>(rels: Rel<T>[] | null | undefined): number[] =>
  (rels ?? []).map(relId).filter((id): id is number => id != null)

/**
 * All tag ids that describe a work: its own `tags` plus its artist's `medium` and
 * `technique` (only when the artist is populated). Deduplicated.
 */
export function workTagIds(work: Work): number[] {
  const ids = new Set(relIds(work.tags))
  if (work.artist && typeof work.artist === 'object') {
    for (const id of relIds(work.artist.medium)) ids.add(id)
    for (const id of relIds(work.artist.technique)) ids.add(id)
  }
  return [...ids]
}

export type Recommendation = {
  work: Work
  /** Number of distinct tags the work shares with the saved works. */
  score: number
  /** Tie-breaker: how often those shared tags occur across the saved works. */
  weight: number
}

export type RecommendInput = {
  /** Works the user has saved (populated with depth >= 1 so artist tags count). */
  saved: Work[]
  /** Works that may be recommended (usually every visible work). */
  candidates: Work[]
  /** Work ids never to recommend, e.g. left swipes. Saved works are always excluded. */
  exclude?: Iterable<number>
  limit?: number
}

/**
 * Ranks candidate works by tag overlap with the saved works.
 * Order: more shared tags first, then higher weight, then lower id (deterministic).
 * Works sharing no tags are left out.
 */
export function recommend({ saved, candidates, exclude = [], limit }: RecommendInput): Recommendation[] {
  const tagFrequency = new Map<number, number>()
  for (const work of saved) {
    for (const tag of workTagIds(work)) tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1)
  }
  if (tagFrequency.size === 0) return []

  const skip = new Set<number>(exclude)
  for (const work of saved) skip.add(work.id)

  const seen = new Set<number>()
  const ranked: Recommendation[] = []
  for (const work of candidates) {
    if (skip.has(work.id) || seen.has(work.id)) continue
    seen.add(work.id)
    let score = 0
    let weight = 0
    for (const tag of workTagIds(work)) {
      const freq = tagFrequency.get(tag)
      if (freq) {
        score += 1
        weight += freq
      }
    }
    if (score > 0) ranked.push({ work, score, weight })
  }

  ranked.sort((a, b) => b.score - a.score || b.weight - a.weight || a.work.id - b.work.id)
  return limit == null ? ranked : ranked.slice(0, limit)
}

export type SwipeContext = {
  savedIds: number[]
  /** Works the user swiped left on. */
  leftIds: number[]
}

/** The user's saved work ids (in saved order) and left-swiped work ids. */
export async function loadSwipeContext(payload: Payload, user: User): Promise<SwipeContext> {
  const [fresh, swipes] = await Promise.all([
    payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: false, user }),
    payload.find({
      collection: 'swipes',
      where: { and: [{ user: { equals: user.id } }, { direction: { equals: 'left' } }] },
      depth: 0,
      pagination: false,
      overrideAccess: false,
      user,
    }),
  ])
  return {
    savedIds: relIds(fresh.saved),
    leftIds: [...new Set(swipes.docs.map((s) => relId(s.work)).filter((id): id is number => id != null))],
  }
}

/**
 * Every publicly visible work, with artist, tags and image populated. Loaded with
 * public access whoever is viewing, so staff don't get unpublished works or
 * staff-only fields in the deck.
 */
export async function loadVisibleWorks(payload: Payload, _user?: User | null): Promise<Work[]> {
  const { docs } = await payload.find({
    collection: 'works',
    depth: 1,
    pagination: false,
    sort: 'id',
    overrideAccess: false,
  })
  // Works whose artist is not readable come back with an unpopulated artist; drop them.
  return docs.filter((w) => typeof w.artist === 'object' && w.artist != null)
}

/**
 * Data-loading wrapper around `recommend`: ranks the visible works for a user from
 * their saved list, excluding saved and left-swiped works.
 */
export async function loadRecommendations(
  payload: Payload,
  user: User,
  options: { limit?: number; works?: Work[]; context?: SwipeContext } = {},
): Promise<Recommendation[]> {
  const [works, context] = await Promise.all([
    options.works ?? loadVisibleWorks(payload, user),
    options.context ?? loadSwipeContext(payload, user),
  ])
  const savedSet = new Set(context.savedIds)
  return recommend({
    saved: works.filter((w) => savedSet.has(w.id)),
    candidates: works,
    exclude: context.leftIds,
    limit: options.limit,
  })
}
