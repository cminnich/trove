import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedServerClient, getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface ForkResponse {
  success: boolean;
  data?: {
    forked_collection_id: string;
    items_cloned: number;
    schemas_cloned: number;
  };
  error?: string;
}

// POST /api/collections/[id]/fork - Fork a collection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceCollectionId } = await params;

    // Authenticate user
    const { client, user, error: authError } = await getAuthenticatedServerClient();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ForkResponse,
        { status: 401 }
      );
    }

    // Use service role for cross-user operations
    const serviceClient = getServiceRoleClient();

    // Fetch source collection - must be public and forkable
    const { data: sourceCollection, error: sourceError } = await serviceClient
      .from("collections")
      .select("*, profiles!collections_owner_id_fkey(username, email)")
      .eq("id", sourceCollectionId)
      .single();

    if (sourceError || !sourceCollection) {
      return NextResponse.json(
        { success: false, error: "Collection not found" } as ForkResponse,
        { status: 404 }
      );
    }

    const typedSource = sourceCollection as Collection & {
      profiles: { username: string | null; email: string | null } | null;
    };

    // Validate collection is public and forkable
    if (typedSource.visibility !== "public") {
      return NextResponse.json(
        { success: false, error: "Can only fork public collections" } as ForkResponse,
        { status: 403 }
      );
    }

    if (!typedSource.is_forkable) {
      return NextResponse.json(
        { success: false, error: "This collection does not allow forking" } as ForkResponse,
        { status: 403 }
      );
    }

    // Prevent self-forking
    if (typedSource.owner_id === user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot fork your own collection" } as ForkResponse,
        { status: 400 }
      );
    }

    // Get source owner username for denormalization
    const sourceOwnerUsername = typedSource.profiles?.username ||
      typedSource.profiles?.email?.split("@")[0] ||
      "unknown";

    // Create the forked collection
    const forkedName = `${typedSource.name} (forked)`;
    const { data: newCollection, error: createError } = await (serviceClient as any)
      .from("collections")
      .insert({
        owner_id: user.id,
        name: forkedName,
        description: typedSource.description,
        type: typedSource.type,
        visibility: "private", // Forks start as private
        is_forkable: true,
        fork_count: 0,
      })
      .select("id")
      .single();

    if (createError || !newCollection) {
      console.error("Failed to create forked collection:", createError);
      return NextResponse.json(
        { success: false, error: "Failed to create forked collection" } as ForkResponse,
        { status: 500 }
      );
    }

    const forkedCollectionId = (newCollection as { id: string }).id;

    // Create fork record for lineage tracking
    const { error: forkRecordError } = await (serviceClient as any)
      .from("collection_forks")
      .insert({
        source_collection_id: sourceCollectionId,
        forked_collection_id: forkedCollectionId,
        source_owner_username: sourceOwnerUsername,
        source_collection_name: typedSource.name,
      });

    if (forkRecordError) {
      console.error("Failed to create fork record:", forkRecordError);
      // Continue anyway - fork metadata is not critical
    }

    // Clone collection_attribute_schemas
    const { data: sourceSchemas, error: schemasError } = await serviceClient
      .from("collection_attribute_schemas")
      .select("*")
      .eq("collection_id", sourceCollectionId);

    let schemasCloned = 0;
    const schemaIdMapping: Record<string, string> = {};

    if (!schemasError && sourceSchemas && sourceSchemas.length > 0) {
      type SchemaRow = Database["public"]["Tables"]["collection_attribute_schemas"]["Row"];

      for (const schema of sourceSchemas) {
        const typedSchema = schema as SchemaRow;
        const oldSchemaId = typedSchema.id;

        // Clone all fields except id, collection_id, and timestamps
        const schemaData = {
          name: typedSchema.name,
          display_name: typedSchema.display_name,
          description: typedSchema.description,
          source_path: typedSchema.source_path,
          value_type: typedSchema.value_type,
          range_config: typedSchema.range_config,
          discovery_confidence: typedSchema.discovery_confidence,
          sample_values: typedSchema.sample_values,
          item_coverage: typedSchema.item_coverage,
          is_visible: typedSchema.is_visible,
          display_order: typedSchema.display_order,
          collection_id: forkedCollectionId,
        };

        const { data: newSchema, error: schemaInsertError } = await (serviceClient as any)
          .from("collection_attribute_schemas")
          .insert(schemaData)
          .select("id")
          .single();

        if (!schemaInsertError && newSchema) {
          schemaIdMapping[oldSchemaId] = (newSchema as { id: string }).id;
          schemasCloned++;
        }
      }
    }

    // Clone collection_items (link to same items)
    const { data: sourceItems, error: itemsError } = await serviceClient
      .from("collection_items")
      .select("item_id, position, notes")
      .eq("collection_id", sourceCollectionId);

    let itemsCloned = 0;

    if (!itemsError && sourceItems && sourceItems.length > 0) {
      const itemsToInsert = sourceItems.map((item) => ({
        collection_id: forkedCollectionId,
        item_id: (item as { item_id: string }).item_id,
        position: (item as { position: number | null }).position,
        notes: (item as { notes: string | null }).notes,
      }));

      const { error: itemsInsertError } = await (serviceClient as any)
        .from("collection_items")
        .insert(itemsToInsert);

      if (!itemsInsertError) {
        itemsCloned = itemsToInsert.length;
      }
    }

    // Clone filter preferences
    const { data: sourcePrefs } = await serviceClient
      .from("collection_filter_preferences")
      .select("schema_id, is_hidden, force_show")
      .eq("collection_id", sourceCollectionId);

    if (sourcePrefs && sourcePrefs.length > 0) {
      const prefsToInsert = sourcePrefs
        .map((pref) => {
          const typedPref = pref as { schema_id: string; is_hidden: boolean; force_show: boolean };
          const newSchemaId = schemaIdMapping[typedPref.schema_id];
          if (!newSchemaId) return null;
          return {
            collection_id: forkedCollectionId,
            schema_id: newSchemaId,
            is_hidden: typedPref.is_hidden,
            force_show: typedPref.force_show,
          };
        })
        .filter(Boolean);

      if (prefsToInsert.length > 0) {
        await (serviceClient as any)
          .from("collection_filter_preferences")
          .insert(prefsToInsert);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        forked_collection_id: forkedCollectionId,
        items_cloned: itemsCloned,
        schemas_cloned: schemasCloned,
      },
    } as ForkResponse);
  } catch (error) {
    console.error("Error forking collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as ForkResponse,
      { status: 500 }
    );
  }
}
