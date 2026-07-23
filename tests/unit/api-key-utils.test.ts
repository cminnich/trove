import { describe, it, expect } from 'vitest'
import {
  generateApiKey,
  hashApiKey,
  getKeyPrefix,
  validateApiKeyFormat,
} from '@/lib/api-key-utils'

describe('api-key-utils', () => {
  describe('generateApiKey', () => {
    it('produces a well-formed trove_sk_ key', () => {
      const key = generateApiKey()
      expect(key.startsWith('trove_sk_')).toBe(true)
      expect(validateApiKeyFormat(key)).toBe(true)
    })

    it('generates unique keys', () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()))
      expect(keys.size).toBe(100)
    })
  })

  describe('hashApiKey', () => {
    it('returns a 64-char hex SHA-256 digest', () => {
      const hash = hashApiKey('trove_sk_example')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('is deterministic for the same input', () => {
      expect(hashApiKey('trove_sk_abc')).toBe(hashApiKey('trove_sk_abc'))
    })

    it('differs for different inputs', () => {
      expect(hashApiKey('trove_sk_abc')).not.toBe(hashApiKey('trove_sk_abd'))
    })

    it('never returns the plaintext key', () => {
      const key = generateApiKey()
      expect(hashApiKey(key)).not.toBe(key)
    })
  })

  describe('getKeyPrefix', () => {
    it('returns the first 16 characters', () => {
      const key = 'trove_sk_abcdefghijklmnop'
      expect(getKeyPrefix(key)).toBe('trove_sk_abcdefg')
      expect(getKeyPrefix(key)).toHaveLength(16)
    })
  })

  describe('validateApiKeyFormat', () => {
    it('accepts a freshly generated key', () => {
      expect(validateApiKeyFormat(generateApiKey())).toBe(true)
    })

    it('rejects keys without the prefix', () => {
      expect(validateApiKeyFormat('sk_1234567890123456789012345678901234')).toBe(false)
    })

    it('rejects keys of the wrong length', () => {
      expect(validateApiKeyFormat('trove_sk_short')).toBe(false)
      expect(validateApiKeyFormat('trove_sk_' + 'a'.repeat(64))).toBe(false)
    })

    it('rejects keys with disallowed characters', () => {
      expect(validateApiKeyFormat('trove_sk_' + '!'.repeat(32))).toBe(false)
    })

    it('rejects the empty string', () => {
      expect(validateApiKeyFormat('')).toBe(false)
    })
  })
})
