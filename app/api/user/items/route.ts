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

    // Step 1: Get all collections owned by the user
    const { data: userCollections, error: collectionsError } = await client
      .from('collections')
      .select('*')
      .eq('owner_id', user.id)

    if (collectionsError) {
      console.error('Error fetching user collections:', collectionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch collections' } as UserItemsResponse,
        { status: 500 }
      )
    }

    const collectionIds = (userCollections as Collection[] | null)?.map(c => c.id) || []

    if (collectionIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      } as UserItemsResponse)
    }

    // Step 2: Get all collection_items for user's collections
    const { data: collectionItems, error: itemsError } = await client
      .from('collection_items')
      .select('*')
      .in('collection_id', collectionIds)

    if (itemsError) {
      console.error('Error fetching collection items:', itemsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch items' } as UserItemsResponse,
        { status: 500 }
      )
    }

    // Step 3: Extract unique item IDs, filtering out excluded collection
    const itemIdSet = new Set<string>()
    const typedCollectionItems = (collectionItems as CollectionItem[] | null) || []
    for (const record of typedCollectionItems) {
      // Skip if this item is from the excluded collection
      if (excludeCollectionId && record.collection_id === excludeCollectionId) {
        continue
      }
      itemIdSet.add(record.item_id)
    }

    const itemIds = Array.from(itemIdSet)

    if (itemIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      } as UserItemsResponse)
    }

    // Step 4: Fetch full item details
    const { data: items, error: fullItemsError } = await client
      .from('items')
      .select('*')
      .in('id', itemIds)

    if (fullItemsError) {
      console.error('Error fetching full items:', fullItemsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch item details' } as UserItemsResponse,
        { status: 500 }
      )
    }

    const uniqueItems = (items as Item[] | null) || []

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
