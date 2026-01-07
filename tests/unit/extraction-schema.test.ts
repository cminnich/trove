import { describe, it, expect } from 'vitest'
import { ProductExtractionSchema } from '@/types/extraction'
import {
  MOCK_WATCH_EXTRACTION,
  MOCK_WINE_EXTRACTION,
  MOCK_BOOK_EXTRACTION,
  MOCK_LOW_CONFIDENCE_EXTRACTION,
  MOCK_MINIMAL_EXTRACTION,
} from '../fixtures/mock-extractions'

describe('ProductExtractionSchema', () => {
  describe('Valid extractions', () => {
    it('should validate a complete watch extraction', () => {
      const result = ProductExtractionSchema.safeParse(MOCK_WATCH_EXTRACTION)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.item_type).toBe('watch')
        expect(result.data.title).toBe('Omega Speedmaster Professional Moonwatch')
        expect(result.data.confidence_score).toBe(0.95)
      }
    })

    it('should validate a complete wine extraction', () => {
      const result = ProductExtractionSchema.safeParse(MOCK_WINE_EXTRACTION)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.item_type).toBe('wine')
        expect(result.data.attributes.vintage).toBe(2019)
      }
    })

    it('should validate a complete book extraction', () => {
      const result = ProductExtractionSchema.safeParse(MOCK_BOOK_EXTRACTION)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.item_type).toBe('book')
        expect(result.data.attributes.author).toBe('Andy Weir')
      }
    })

    it('should validate low confidence extractions', () => {
      const result = ProductExtractionSchema.safeParse(MOCK_LOW_CONFIDENCE_EXTRACTION)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.confidence_score).toBe(0.45)
        expect(result.data.confidence_score).toBeLessThan(0.7)
      }
    })

    it('should validate minimal extraction with only required fields', () => {
      const result = ProductExtractionSchema.safeParse(MOCK_MINIMAL_EXTRACTION)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Generic Product')
        expect(result.data.brand).toBeNull()
        expect(result.data.attributes).toEqual({})
      }
    })
  })

  describe('Required fields', () => {
    it('should require title field', () => {
      const invalidData = { ...MOCK_MINIMAL_EXTRACTION }
      delete (invalidData as any).title

      const result = ProductExtractionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should require confidence_score', () => {
      const invalidData = { ...MOCK_MINIMAL_EXTRACTION }
      delete (invalidData as any).confidence_score

      const result = ProductExtractionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should require attributes field', () => {
      const invalidData = { ...MOCK_MINIMAL_EXTRACTION }
      delete (invalidData as any).attributes

      const result = ProductExtractionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should default item_type to "product" if missing', () => {
      const dataWithoutType = { ...MOCK_MINIMAL_EXTRACTION }
      delete (dataWithoutType as any).item_type

      const result = ProductExtractionSchema.safeParse(dataWithoutType)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.item_type).toBe('product')
      }
    })
  })

  describe('Field validation', () => {
    it('should accept confidence_score between 0 and 1', () => {
      const data1 = { ...MOCK_MINIMAL_EXTRACTION, confidence_score: 0 }
      const data2 = { ...MOCK_MINIMAL_EXTRACTION, confidence_score: 1 }
      const data3 = { ...MOCK_MINIMAL_EXTRACTION, confidence_score: 0.5 }

      expect(ProductExtractionSchema.safeParse(data1).success).toBe(true)
      expect(ProductExtractionSchema.safeParse(data2).success).toBe(true)
      expect(ProductExtractionSchema.safeParse(data3).success).toBe(true)
    })

    it('should reject confidence_score outside 0-1 range', () => {
      const dataNegative = { ...MOCK_MINIMAL_EXTRACTION, confidence_score: -0.1 }
      const dataOverOne = { ...MOCK_MINIMAL_EXTRACTION, confidence_score: 1.1 }

      expect(ProductExtractionSchema.safeParse(dataNegative).success).toBe(false)
      expect(ProductExtractionSchema.safeParse(dataOverOne).success).toBe(false)
    })

    it('should require image_url to be valid URL if provided', () => {
      const validUrl = { ...MOCK_MINIMAL_EXTRACTION, image_url: 'https://example.com/image.jpg' }
      const invalidUrl = { ...MOCK_MINIMAL_EXTRACTION, image_url: 'not-a-valid-url' }

      expect(ProductExtractionSchema.safeParse(validUrl).success).toBe(true)
      expect(ProductExtractionSchema.safeParse(invalidUrl).success).toBe(false)
    })

    it('should accept null for optional fields', () => {
      const result = ProductExtractionSchema.safeParse({
        title: 'Test Product',
        brand: null,
        price: null,
        currency: null,
        retailer: null,
        image_url: null,
        category: null,
        tags: null,
        attributes: {},
        confidence_score: 0.8,
      })

      expect(result.success).toBe(true)
    })

    it('should accept price as number', () => {
      const validPrice = { ...MOCK_MINIMAL_EXTRACTION, price: 99.99 }
      const invalidPrice = { ...MOCK_MINIMAL_EXTRACTION, price: '$99.99' }

      expect(ProductExtractionSchema.safeParse(validPrice).success).toBe(true)
      expect(ProductExtractionSchema.safeParse(invalidPrice).success).toBe(false)
    })

    it('should accept tags as array of strings', () => {
      const validTags = { ...MOCK_MINIMAL_EXTRACTION, tags: ['tag1', 'tag2'] }
      const invalidTags = { ...MOCK_MINIMAL_EXTRACTION, tags: 'not-an-array' }

      expect(ProductExtractionSchema.safeParse(validTags).success).toBe(true)
      expect(ProductExtractionSchema.safeParse(invalidTags).success).toBe(false)
    })
  })

  describe('Attributes field', () => {
    it('should accept empty attributes object', () => {
      const result = ProductExtractionSchema.safeParse({
        ...MOCK_MINIMAL_EXTRACTION,
        attributes: {},
      })
      expect(result.success).toBe(true)
    })

    it('should accept complex nested attributes', () => {
      const result = ProductExtractionSchema.safeParse({
        ...MOCK_MINIMAL_EXTRACTION,
        attributes: {
          nested: {
            deeply: {
              value: 'test',
            },
          },
          arrays: [1, 2, 3],
          mixed: ['string', 123, true],
        },
      })
      expect(result.success).toBe(true)
    })

    it('should accept snake_case attributes (watch example)', () => {
      const result = ProductExtractionSchema.safeParse(MOCK_WATCH_EXTRACTION)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.attributes).toHaveProperty('case_size_mm')
        expect(result.data.attributes).toHaveProperty('power_reserve_hours')
      }
    })
  })
})
