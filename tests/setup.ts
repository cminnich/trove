import { beforeAll } from 'vitest'

// Load environment variables for tests
beforeAll(() => {
  // Ensure required env vars are set for tests
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('Warning: NEXT_PUBLIC_SUPABASE_URL not set')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Warning: NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('Warning: ANTHROPIC_API_KEY not set - extraction tests will fail')
  }
})
