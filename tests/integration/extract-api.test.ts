import { describe, it, expect, beforeAll } from 'vitest'
import { ProductExtractionSchema } from '@/types/extraction'
import type { ExtractResponse } from '@/types/extraction'
import { TEST_URLS } from '../fixtures/test-urls'

/**
 * Integration tests for /api/extract endpoint
 *
 * REQUIREMENTS:
 * 1. Next.js dev server must be running: npm run dev
 * 2. For live extraction tests: Set ANTHROPIC_API_KEY in .env.local
 *
 * Run with: npm run dev (in one terminal), then npm run test (in another)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
const HAS_API_KEYS = !!(
  process.env.ANTHROPIC_API_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL
)

async function callExtractAPI(url: string): Promise<Response> {
  return fetch(`${API_BASE}/api/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  })
}

describe('/api/extract', () => {
  beforeAll(() => {
    if (!HAS_API_KEYS) {
      console.log('⚠️  API keys not available - skipping live extraction tests')
    }
  })

  describe('Error handling (no API required)', () => {
    it('should return 400 for missing URL', async () => {
      const response = await fetch(`${API_BASE}/api/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      const data: ExtractResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('URL is required')
    })

    it('should return 400 for invalid URL format', async () => {
      const response = await callExtractAPI(TEST_URLS.invalid_url)

      expect(response.status).toBe(400)
      const data: ExtractResponse = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid URL format')
    })

    it('should handle unreachable domains gracefully', async () => {
      if (!HAS_API_KEYS) {
        console.log('  ⊘ Skipping: requires API keys')
        return
      }

      const response = await callExtractAPI(TEST_URLS.unreachable_url)

      // Should either fail at Jina fetch or return low confidence
      const data: ExtractResponse = await response.json()

      if (!data.success) {
        // Failed at Jina fetch - this is acceptable
        expect(data.error).toBeTruthy()
      } else {
        // Or returned low confidence extraction
        expect(data.data?.confidence_score).toBeLessThan(0.7)
      }
    }, 30000) // 30s timeout for network requests
  })

  describe('Successful extraction (requires API keys)', () => {
    it.skipIf(!HAS_API_KEYS)('should extract watch data from Hodinkee article', async () => {
      const response = await callExtractAPI(TEST_URLS.watch_hodinkee)

      expect(response.ok).toBe(true)
      const data: ExtractResponse = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()

      if (data.data) {
        // Validate schema compliance
        const validated = ProductExtractionSchema.parse(data.data)

        // Check core fields
        expect(validated.title).toBeTruthy()
        expect(validated.item_type).toBeTruthy()
        expect(validated.confidence_score).toBeGreaterThanOrEqual(0)
        expect(validated.confidence_score).toBeLessThanOrEqual(1)

        // Check metadata fields added by API
        expect(data.data.source_url).toBe(TEST_URLS.watch_hodinkee)
        expect(data.data.raw_markdown).toBeTruthy()
        expect(data.data.extraction_model).toBe('claude-sonnet-4-20250514')

        // Log extraction for manual review
        console.log('\n📊 Watch extraction:', {
          item_type: validated.item_type,
          title: validated.title,
          brand: validated.brand,
          confidence: validated.confidence_score,
        })
      }
    }, 60000) // 60s timeout for full extraction

    it.skipIf(!HAS_API_KEYS)('should flag low confidence extractions', async () => {
      // Use non-product page to get low confidence
      const response = await callExtractAPI(TEST_URLS.non_product_page)

      const data: ExtractResponse = await response.json()

      if (data.success && data.data) {
        if (data.data.confidence_score < 0.7) {
          expect(data.needs_review).toBe(true)
          console.log('\n⚠️  Low confidence extraction flagged correctly')
        } else {
          console.log('\n✓ Example.com returned high confidence (expected)')
        }
      }
    }, 60000)
  })

  describe('Response structure', () => {
    it.skipIf(!HAS_API_KEYS)('should include all required response fields', async () => {
      const response = await callExtractAPI(TEST_URLS.watch_hodinkee)
      const data: ExtractResponse = await response.json()

      expect(data).toHaveProperty('success')

      if (data.success) {
        expect(data.data).toBeDefined()
        expect(data.data).toHaveProperty('source_url')
        expect(data.data).toHaveProperty('raw_markdown')
        expect(data.data).toHaveProperty('extraction_model')
        expect(data.data).toHaveProperty('title')
        expect(data.data).toHaveProperty('item_type')
        expect(data.data).toHaveProperty('confidence_score')
        expect(data.data).toHaveProperty('attributes')
      } else {
        expect(data.error).toBeDefined()
      }
    }, 60000)

    it.skipIf(!HAS_API_KEYS)('should set needs_review flag correctly', async () => {
      const response = await callExtractAPI(TEST_URLS.watch_hodinkee)
      const data: ExtractResponse = await response.json()

      if (data.success && data.data) {
        if (data.data.confidence_score < 0.7) {
          expect(data.needs_review).toBe(true)
        } else {
          expect(data.needs_review).toBe(false)
        }
      }
    }, 60000)
  })

  describe('Different product types (requires API keys)', () => {
    it.skipIf(!HAS_API_KEYS)('should handle wine URLs', async () => {
      const response = await callExtractAPI(TEST_URLS.wine_vivino)
      const data: ExtractResponse = await response.json()

      if (data.success && data.data) {
        expect(data.data.item_type).toBeTruthy()
        console.log('\n🍷 Wine extraction:', {
          item_type: data.data.item_type,
          title: data.data.title,
          confidence: data.data.confidence_score,
        })
      }
    }, 60000)

    it.skipIf(!HAS_API_KEYS)('should handle book URLs', async () => {
      const response = await callExtractAPI(TEST_URLS.book_amazon)
      const data: ExtractResponse = await response.json()

      if (data.success && data.data) {
        expect(data.data.item_type).toBeTruthy()
        console.log('\n📚 Book extraction:', {
          item_type: data.data.item_type,
          title: data.data.title,
          confidence: data.data.confidence_score,
        })
      }
    }, 60000)
  })
})
