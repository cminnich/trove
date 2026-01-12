import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedServerClient } from '@/lib/supabase-server'
import type { Database } from '@/types/database'

type Item = Database['public']['Tables']['items']['Row']
type Collection = Database['public']['Tables']['collections']['Row']
type CollectionItem = Database['public']['Tables']['collection_items']['Row']

interface UserItemsResponse {
  success: boolean
  data?: Item[]
  error?: string
}

/**
 * GET /api/user/items
 * Returns all distinct items across all user's collections
 * Optionally exclude items from a specific collection
 */
export async function GET(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getAuthenticatedServerClient()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as UserItemsResponse,
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const excludeCollectionId = searchParams.get('excludeCollection')

    // Fetch all collection_items that belong to user's collections
    // Join with items to get full item details
    // Join with collections to filter by user_id
    let query = client
      .from('collection_items')
      .select(`
        item_id,
        items!inner (
          id,
          url,
          title,
          brand,
          price,
          currency,
          image_url,
          category,
          retailer,
          tags,
          metadata,
          created_at,
          updated_at,
          user_id
        ),
        collections!inner (
          user_id
        )
      `)
      .eq('collections.user_id', user.id)

    // Exclude items from specific collection if provided
    if (excludeCollectionId) {
      query = query.neq('collection_id', excludeCollectionId)
    }

    const { data: collectionItemsWithDetails, error: queryError } = await query

    if (queryError) {
      console.error('Error fetching items:', queryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch items' } as UserItemsResponse,
        { status: 500 }
      )
    }

    // Extract unique items (same item might be in multiple collections)
    const itemsMap = new Map<string, Item>()

    if (collectionItemsWithDetails) {
      for (const record of collectionItemsWithDetails) {
        // @ts-expect-error - Supabase join typing
        const item = record.items as Item
        if (item && !itemsMap.has(item.id)) {
          itemsMap.set(item.id, item)
        }
      }
    }

    const uniqueItems = Array.from(itemsMap.values())

    // Sort by most recently created
    uniqueItems.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    return NextResponse.json({
      success: true,
      data: uniqueItems
    } as UserItemsResponse)
  } catch (error) {
    console.error('Error in GET /api/user/items:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as UserItemsResponse,
      { status: 500 }
    )
  }
}
