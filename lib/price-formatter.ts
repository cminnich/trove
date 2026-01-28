/**
 * Utility functions for formatting prices
 */

/**
 * Formats a price with smart decimal handling:
 * - Whole numbers display without decimals (e.g., "$19")
 * - Numbers with cents display with 2 decimals (e.g., "$19.20")
 *
 * @param price - The price value to format
 * @param currency - The currency code (e.g., "USD", "EUR")
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}
