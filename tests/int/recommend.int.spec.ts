import { describe, expect, it } from 'vitest'

import type { Artist, Tag, Work } from '@/payload-types'
import { recommend, workTagIds } from '@/lib/recommend'
import { seededShuffle, swipeOrder } from '@/lib/recommend.order'

const ts = '2026-01-01T00:00:00.000Z'

const tag = (id: number): Tag => ({
  id,
  name: `t${id}`,
  slug: `t${id}`,
  kind: 'subject',
  updatedAt: ts,
  createdAt: ts,
})

const artist = (id: number, medium: number[] = [], technique: number[] = []): Artist =>
  ({
    id,
    handle: `a${id}`,
    name: `Artist ${id}`,
    status: 'published',
    medium,
    technique,
    updatedAt: ts,
    createdAt: ts,
  }) as Artist

const work = (id: number, tags: number[], a: Artist | number = 99, populateTags = true): Work => ({
  id,
  artist: a,
  source: 'upload',
  tags: populateTags ? tags.map(tag) : tags,
  updatedAt: ts,
  createdAt: ts,
})

const ids = (recs: { work: Work }[]) => recs.map((r) => r.work.id)

describe('workTagIds', () => {
  it('merges work tags with the artist medium and technique, deduplicated', () => {
    const w = work(1, [1, 2], artist(5, [2, 3], [4]))
    expect(workTagIds(w).sort()).toEqual([1, 2, 3, 4])
  })

  it('accepts unpopulated tags and ignores an unpopulated artist', () => {
    expect(workTagIds(work(1, [7, 8], 5, false)).sort()).toEqual([7, 8])
  })
})

describe('recommend', () => {
  it('returns nothing without saved works', () => {
    expect(recommend({ saved: [], candidates: [work(1, [1])] })).toEqual([])
  })

  it('ranks by number of shared tags and drops works with none', () => {
    const saved = [work(1, [1, 2, 3])]
    const candidates = [work(2, [1]), work(3, [1, 2, 3]), work(4, [9]), work(5, [2, 3])]
    const recs = recommend({ saved, candidates })
    expect(ids(recs)).toEqual([3, 5, 2])
    expect(recs.map((r) => r.score)).toEqual([3, 2, 1])
  })

  it('counts artist medium and technique as tags', () => {
    const saved = [work(1, [1], artist(10, [20], [30]))]
    const candidates = [work(2, [], artist(11, [20], [30])), work(3, [1])]
    expect(ids(recommend({ saved, candidates }))).toEqual([2, 3])
  })

  it('excludes saved and excluded (left-swiped) works', () => {
    const saved = [work(1, [1])]
    const candidates = [work(1, [1]), work(2, [1]), work(3, [1])]
    expect(ids(recommend({ saved, candidates, exclude: [2] }))).toEqual([3])
  })

  it('breaks score ties by tag frequency across saved works, then by id', () => {
    // Tag 1 is in two saved works, tag 2 in one.
    const saved = [work(1, [1, 2]), work(2, [1])]
    const candidates = [work(7, [2]), work(5, [1]), work(4, [2]), work(6, [1])]
    expect(ids(recommend({ saved, candidates }))).toEqual([5, 6, 4, 7])
  })

  it('is deterministic regardless of candidate order, and respects the limit', () => {
    const saved = [work(1, [1, 2])]
    const candidates = [work(2, [1]), work(3, [2]), work(4, [1, 2]), work(5, [1])]
    const a = recommend({ saved, candidates, limit: 3 })
    const b = recommend({ saved, candidates: [...candidates].reverse(), limit: 3 })
    expect(ids(a)).toEqual([4, 2, 3])
    expect(ids(b)).toEqual(ids(a))
  })

  it('ignores duplicate candidates', () => {
    const saved = [work(1, [1])]
    expect(ids(recommend({ saved, candidates: [work(2, [1]), work(2, [1])] }))).toEqual([2])
  })
})

describe('swipe order', () => {
  it('shuffles deterministically per seed and keeps every item once', () => {
    const items = Array.from({ length: 30 }, (_, i) => i + 1)
    const a = seededShuffle(items, 42)
    expect(seededShuffle(items, 42)).toEqual(a)
    expect(seededShuffle(items, 43)).not.toEqual(a)
    expect([...a].sort((x, y) => x - y)).toEqual(items)
  })

  it('puts earlier tiers first and drops ids repeated in later tiers', () => {
    const order = swipeOrder([[3, 1], [1, 2, 4, 3], [5]], 7)
    expect(order).toHaveLength(5)
    expect(order.slice(0, 2).sort()).toEqual([1, 3])
    expect(order.slice(2, 4).sort()).toEqual([2, 4])
    expect(order[4]).toBe(5)
  })
})
