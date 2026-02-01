import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient } from "@/lib/supabase-server";
import { identifyFromPhoto } from "@/lib/ai";
import { searchProductUrl, type ProductSearchResult } from "@/lib/product-search";
import type { PhotoIdentificationItem } from "@/types/extraction";

interface IdentifiedItem {
  identification: PhotoIdentificationItem;
  candidates: ProductSearchResult[];
}

interface PhotoIdentifyResponse {
  success: boolean;
  items?: IdentifiedItem[];
  scene_description?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const { user, error: authError } = await getAuthenticatedServerClient();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as PhotoIdentifyResponse,
        { status: 401 }
      );
    }

    const body = await req.json();
    const { image, mimeType } = body as {
      image: string;
      mimeType: string;
    };

    if (!image || !mimeType) {
      return NextResponse.json(
        {
          success: false,
          error: "image (base64) and mimeType are required",
        } as PhotoIdentifyResponse,
        { status: 400 }
      );
    }

    // Validate mime type
    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid mimeType. Must be one of: ${validMimeTypes.join(", ")}`,
        } as PhotoIdentifyResponse,
        { status: 400 }
      );
    }

    // Step 1: Identify products via Claude Vision
    const identification = await identifyFromPhoto(image, mimeType);

    if (!identification.items || identification.items.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        scene_description: identification.scene_description,
      } as PhotoIdentifyResponse);
    }

    // Step 2: Search for product URLs for each identified item
    const items: IdentifiedItem[] = await Promise.all(
      identification.items.map(async (item) => {
        const candidates = await searchProductUrl(item.search_query);
        return { identification: item, candidates };
      })
    );

    return NextResponse.json({
      success: true,
      items,
      scene_description: identification.scene_description,
    } as PhotoIdentifyResponse);
  } catch (error) {
    console.error("Photo identification error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      } as PhotoIdentifyResponse,
      { status: 500 }
    );
  }
}
