import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type AttributeSchema = Database["public"]["Tables"]["attribute_schemas"]["Row"];

interface SchemasResponse {
  success: boolean;
  data?: AttributeSchema[];
  error?: string;
}

// GET /api/attributes/schemas - List all active attribute schemas
export async function GET() {
  try {
    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from("attribute_schemas")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch attribute schemas:", error);
      return NextResponse.json(
        { success: false, error: error.message } as SchemasResponse,
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as AttributeSchema[],
    } as SchemasResponse);
  } catch (error) {
    console.error("Error fetching attribute schemas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as SchemasResponse,
      { status: 500 }
    );
  }
}
