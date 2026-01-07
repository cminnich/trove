import { ExtractResponse } from '@/types/extraction'

/**
 * Test helper utilities
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

/**
 * Helper to make API requests during tests
 */
export async function callExtractAPI(url: string): Promise<ExtractResponse> {
  const response = await fetch(`${API_BASE_URL}/api/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Wait for a promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

/**
 * Check if we're in a test environment with API access
 */
export function hasAPIAccess(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/**
 * Skip test if API access is not available
 */
export function skipIfNoAPI(testFn: () => void | Promise<void>) {
  return hasAPIAccess()
    ? testFn
    : () => {
        console.log('Skipping test: API credentials not available')
      }
}
