import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase";

type ItemCategoryResult = {
  category: string | null;
}

type CollectionIdResult = {
  id: string;
}

type CollectionItemResult = {
  item_id: string;
}

/**
 * GET /api/categories
 * Returns all unique categories used by the authenticated user's items
 */
export async function GET() {
  try {
    const supabase = getServerClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Query all items owned by user through collections
    const { data: collections, error: collError } = await supabase
      .from('collections')
      .select('id')
      .eq('owner_id', user.id);

    if (collError || !collections) {
      console.error('Error fetching collections:', collError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch collections" },
        { status: 500 }
      );
    }

    const collectionIds = (collections as CollectionIdResult[]).map(c => c.id);

    // Get all items in user's collections
    const { data: collectionItems, error: ciError } = await supabase
      .from('collection_items')
      .select('item_id')
      .in('collection_id', collectionIds);

    if (ciError || !collectionItems) {
      console.error('Error fetching collection items:', ciError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch items" },
        { status: 500 }
      );
    }

    const itemIds = (collectionItems as CollectionItemResult[]).map(ci => ci.item_id);

    if (itemIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Get categories from items
    const { data: items, error } = await supabase
      .from('items')
      .select('category')
      .in('id', itemIds)
      .not('category', 'is', null);

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch categories" },
        { status: 500 }
      );
    }

    // Extract unique categories and sort alphabetically
    const categories = [...new Set(
      (items as ItemCategoryResult[])
        .map(item => item.category)
        .filter((cat): cat is string => cat !== null && cat !== '')
    )].sort();

    return NextResponse.json({
      success: true,
      data: categories,
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/categories:', error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
