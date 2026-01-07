/**
 * Test URLs for extraction testing
 * These are real product URLs that should work with Jina AI Reader
 */

export const TEST_URLS = {
  // Watches - well-structured product pages
  watch_hodinkee: 'https://www.hodinkee.com/articles/the-omega-speedmaster-professional-moonwatch',
  watch_chrono24: 'https://www.chrono24.com/omega/speedmaster-professional-moonwatch--id123456.htm',

  // Wine - structured with detailed specs
  wine_vivino: 'https://www.vivino.com/opus-one-winery-opus-one/w/1',

  // Books - consistent metadata
  book_amazon: 'https://www.amazon.com/Project-Hail-Mary-Andy-Weir/dp/0593135202',

  // Sneakers - good for attributes testing
  sneaker_nike: 'https://www.nike.com/t/air-jordan-1-retro-high-og',

  // Electronics - complex specs
  camera_bhphoto: 'https://www.bhphotovideo.com/c/product/1394217-REG/sony_ilce7m3_b_alpha_a7_iii_mirrorless.html',

  // Invalid/Edge cases
  invalid_url: 'not-a-url',
  unreachable_url: 'https://this-domain-definitely-does-not-exist-12345.com',
  non_product_page: 'https://www.example.com',
} as const

export type TestUrlKey = keyof typeof TEST_URLS
