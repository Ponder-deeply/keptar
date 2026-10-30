import { describe, expect, it } from 'vitest'

import { formatDuration, parseDuration, splitIntoSections } from '../../scripts/lib/batches'

describe('splitIntoSections', () => {
  it('splits in order into near-equal sections, larger ones first', () => {
    expect(splitIntoSections([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5], [6, 7]])
    expect(splitIntoSections([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('never makes empty sections', () => {
    expect(splitIntoSections([1, 2], 5)).toEqual([[1], [2]])
    expect(splitIntoSections([], 3)).toEqual([])
  })

  it('rejects a non-positive count', () => {
    expect(() => splitIntoSections([1], 0)).toThrow(/positive integer/)
    expect(() => splitIntoSections([1], 1.5)).toThrow(/positive integer/)
  })
})

describe('parseDuration', () => {
  it('reads seconds, minutes and hours', () => {
    expect(parseDuration('90')).toBe(90_000)
    expect(parseDuration('90s')).toBe(90_000)
    expect(parseDuration('30m')).toBe(1_800_000)
    expect(parseDuration('1.5h')).toBe(5_400_000)
    expect(parseDuration(' 2H ')).toBe(7_200_000)
  })

  it('rejects anything else', () => {
    expect(() => parseDuration('soon')).toThrow(/not a duration/)
    expect(() => parseDuration('-5m')).toThrow(/not a duration/)
  })

  it('formats back', () => {
    expect([formatDuration(90_000), formatDuration(1_800_000), formatDuration(7_200_000)]).toEqual(['90s', '30m', '2h'])
  })
})
