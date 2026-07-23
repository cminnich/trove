import { describe, it, expect } from 'vitest'
import { trimItem, sanitizeSearchQuery } from '@/lib/assistant-tools'

describe('trimItem', () => {
  it('keeps only the compact fields the model needs', () => {
    const item = {
      id: 'abc',
      title: 'Omega Speedmaster',
      brand: 'Omega',
      price: 6500,
      currency: 'USD',
      category: 'Watches',
      item_type: 'watch',
      tags: ['chronograph'],
      // extra fields that must NOT survive
      raw_markdown: 'HUGE BLOB',
      owner_id: 'user-1',
      extraction_status: 'complete',
    }

    const trimmed = trimItem(item as never)
    expect(trimmed).toEqual({
      id: 'abc',
      title: 'Omega Speedmaster',
      brand: 'Omega',
      price: 6500,
      currency: 'USD',
      category: 'Watches',
      item_type: 'watch',
      tags: ['chronograph'],
    })
    expect('raw_markdown' in trimmed).toBe(false)
    expect('owner_id' in trimmed).toBe(false)
  })
})

describe('sanitizeSearchQuery', () => {
  it('passes ordinary queries through', () => {
    expect(sanitizeSearchQuery('omega speedmaster')).toBe('omega speedmaster')
  })

  it('neutralizes PostgREST or() grammar characters', () => {
    expect(sanitizeSearchQuery('a,b(c)d%e_f\\g')).toBe('a b c d e f g')
  })

  it('trims to empty for wildcard-only input', () => {
    expect(sanitizeSearchQuery('%%%___')).toBe('')
  })
})
