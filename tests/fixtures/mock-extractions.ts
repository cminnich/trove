import { ProductExtraction } from '@/types/extraction'

/**
 * Mock extraction results for testing schema validation
 */

export const MOCK_WATCH_EXTRACTION: ProductExtraction = {
  item_type: 'watch',
  title: 'Omega Speedmaster Professional Moonwatch',
  brand: 'Omega',
  price: 6500,
  currency: 'USD',
  retailer: 'Hodinkee',
  image_url: 'https://example.com/omega-speedmaster.jpg',
  category: 'Luxury Goods',
  tags: ['chronograph', 'manual-wind', 'moonwatch'],
  attributes: {
    reference_number: '310.30.42.50.01.001',
    case_size_mm: 42,
    case_material: 'steel',
    movement_type: 'manual',
    movement_caliber: '3861',
    water_resistance_meters: 50,
    power_reserve_hours: 50,
    complications: ['chronograph', 'tachymeter'],
  },
  confidence_score: 0.95,
}

export const MOCK_WINE_EXTRACTION: ProductExtraction = {
  item_type: 'wine',
  title: 'Opus One 2019',
  brand: 'Opus One',
  price: 450,
  currency: 'USD',
  retailer: 'Wine.com',
  image_url: 'https://example.com/opus-one.jpg',
  category: 'Wine',
  tags: ['red', 'napa', 'bordeaux-blend'],
  attributes: {
    vintage: 2019,
    varietal: 'Cabernet Sauvignon blend',
    region: 'Napa Valley',
    appellation: 'Oakville',
    alcohol_percentage: 14.5,
    bottle_size_ml: 750,
  },
  confidence_score: 0.92,
}

export const MOCK_BOOK_EXTRACTION: ProductExtraction = {
  item_type: 'book',
  title: 'Project Hail Mary',
  brand: 'Andy Weir',
  price: 15.99,
  currency: 'USD',
  retailer: 'Amazon',
  image_url: 'https://example.com/project-hail-mary.jpg',
  category: 'Books',
  tags: ['sci-fi', 'space', 'fiction'],
  attributes: {
    author: 'Andy Weir',
    isbn: '0593135202',
    format: 'Hardcover',
    pages: 496,
    publisher: 'Ballantine Books',
    publication_year: 2021,
  },
  confidence_score: 0.98,
}

export const MOCK_LOW_CONFIDENCE_EXTRACTION: ProductExtraction = {
  item_type: 'product',
  title: 'Unknown Product',
  brand: null,
  price: null,
  currency: null,
  retailer: 'Example Store',
  image_url: null,
  category: null,
  tags: null,
  attributes: {},
  confidence_score: 0.45, // Below 0.7 threshold
}

export const MOCK_MINIMAL_EXTRACTION: ProductExtraction = {
  item_type: 'product',
  title: 'Generic Product',
  brand: null,
  price: null,
  currency: null,
  retailer: null,
  image_url: null,
  category: null,
  tags: null,
  attributes: {},
  confidence_score: 0.7,
}
