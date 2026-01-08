import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * GET /api/items/recent
 * Returns last N items ordered by created_at DESC
 * Used for "Recently Troved" section
 */
export async function GET(request: NextRequest) {
  try {
    // Get limit from query params (default 5)
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    // Clamp limit between 1 and 20
    const clampedLimit = Math.max(1, Math.min(20, limit))

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient<Database>(supabaseUrl, supabaseKey)

    // Fetch recent items
    const { data: items, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(clampedLimit)

    if (error) {
      console.error('Error fetching recent items:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch recent items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: items || []
    })
  } catch (error) {
    console.error('Error in GET /api/items/recent:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
