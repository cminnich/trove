import { describe, it, expect } from 'vitest'
import { sortCollectionsByRecency, getCollectionRecency } from '@/lib/collection-recency'

const c = (id: string) => ({ id, name: id })

describe('sortCollectionsByRecency', () => {
  it('floats recently-used collections to the front, most recent first', () => {
    const collections = [c('a'), c('b'), c('d')]
    const recency = { b: 200, d: 100 }
    expect(sortCollectionsByRecency(collections, recency).map((x) => x.id)).toEqual([
      'b',
      'd',
      'a',
    ])
  })

  it('keeps never-used collections in their original relative order (stable)', () => {
    const collections = [c('a'), c('b'), c('d'), c('e')]
    const recency = { d: 500 }
    expect(sortCollectionsByRecency(collections, recency).map((x) => x.id)).toEqual([
      'd',
      'a',
      'b',
      'e',
    ])
  })

  it('returns original order when there is no recency data', () => {
    const collections = [c('a'), c('b'), c('d')]
    expect(sortCollectionsByRecency(collections, {}).map((x) => x.id)).toEqual([
      'a',
      'b',
      'd',
    ])
  })

  it('does not mutate the input array', () => {
    const collections = [c('a'), c('b')]
    sortCollectionsByRecency(collections, { b: 1 })
    expect(collections.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('getCollectionRecency', () => {
  it('returns an empty map when localStorage is unavailable (server)', () => {
    expect(getCollectionRecency()).toEqual({})
  })
})
