import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database";

/**
 * Data access for the in-app Trove Assistant (/api/chat).
 *
 * Reads use the service-role client ONLY after an explicit access check
 * (owner or editor-shared), mirroring the v1 API patterns. Mutations run on
 * the caller's authenticated RLS client, same as the internal REST routes.
 */

type Item = Database["public"]["Tables"]["items"]["Row"];
type AuthedClient = SupabaseClient<Database>;

/** Compact item shape returned to the model — keeps tool results small. */
export interface TrimmedItem {
  id: string;
  title: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  item_type: string;
  tags: string[] | null;
}

export function trimItem(item: Pick<Item, keyof TrimmedItem>): TrimmedItem {
  return {
    id: item.id,
    title: item.title,
    brand: item.brand,
    price: item.price,
    currency: item.currency,
    category: item.category,
    item_type: item.item_type,
    tags: item.tags,
  };
}

/**
 * Neutralize characters that would break/inject into the PostgREST or()
 * filter grammar (commas and parens group terms; % and _ are LIKE wildcards).
 * Same sanitization as the v1 search endpoint.
 */
export function sanitizeSearchQuery(q: string): string {
  return q.replace(/[,()%_\\]/g, " ").trim();
}

const MAX_ITEMS = 100;

/** Collection ids the user owns, plus ids shared with them at editor level. */
async function getAccessibleCollectionIds(
  userId: string
): Promise<{ owned: Set<string>; editor: Set<string> }> {
  const supabase = getServiceRoleClient();

  const { data: ownedRows } = await supabase
    .from("collections")
    .select("id")
    .eq("owner_id", userId);

  const { data: accessRows } = await supabase
    .from("collection_access")
    .select("collection_id")
    .eq("user_id", userId)
    .eq("access_level", "editor");

  return {
    owned: new Set(((ownedRows || []) as { id: string }[]).map((r) => r.id)),
    editor: new Set(
      ((accessRows || []) as { collection_id: string }[]).map((r) => r.collection_id)
    ),
  };
}

export async function listCollectionsForUser(userId: string) {
  const supabase = getServiceRoleClient();
  const { owned, editor } = await getAccessibleCollectionIds(userId);
  const allIds = [...owned, ...editor];
  if (allIds.length === 0) return [];

  const { data, error } = await supabase
    .from("collections")
    .select("id, name, description, type, visibility, updated_at")
    .in("id", allIds)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  type Row = Pick<
    Database["public"]["Tables"]["collections"]["Row"],
    "id" | "name" | "description" | "type" | "visibility" | "updated_at"
  >;
  return ((data || []) as Row[]).map((c) => ({
    ...c,
    access: owned.has(c.id) ? ("owner" as const) : ("editor" as const),
  }));
}

export async function getCollectionItemsForUser(userId: string, collectionId: string) {
  // Access check BEFORE any service-role fetch — a bare id must not leak
  // someone else's collection.
  const { owned, editor } = await getAccessibleCollectionIds(userId);
  if (!owned.has(collectionId) && !editor.has(collectionId)) {
    return { error: "Collection not found or you don't have access to it." };
  }

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("collection_items")
    .select(
      "notes, position, items (id, title, brand, price, currency, category, item_type, tags, attributes)"
    )
    .eq("collection_id", collectionId)
    .order("position", { ascending: true, nullsFirst: false })
    .limit(MAX_ITEMS);

  if (error) return { error: error.message };

  type Row = {
    notes: string | null;
    position: number | null;
    items: Pick<Item, keyof TrimmedItem | "attributes">;
  };
  const items = ((data || []) as unknown as Row[]).map((ci) => ({
    ...trimItem(ci.items),
    attributes: ci.items.attributes,
    notes: ci.notes,
  }));

  return {
    items,
    count: items.length,
    truncated: items.length === MAX_ITEMS,
    access: owned.has(collectionId) ? ("owner" as const) : ("editor" as const),
  };
}

export async function searchItemsForUser(userId: string, query: string) {
  const safeQ = sanitizeSearchQuery(query);
  if (!safeQ) return { items: [], count: 0 };

  const { owned, editor } = await getAccessibleCollectionIds(userId);
  const allIds = [...owned, ...editor];
  if (allIds.length === 0) return { items: [], count: 0 };

  const supabase = getServiceRoleClient();
  const { data: links } = await supabase
    .from("collection_items")
    .select("item_id")
    .in("collection_id", allIds);

  const itemIds = [
    ...new Set(((links || []) as { item_id: string }[]).map((l) => l.item_id)),
  ];
  if (itemIds.length === 0) return { items: [], count: 0 };

  const pattern = `%${safeQ}%`;
  const { data, error } = await supabase
    .from("items")
    .select("id, title, brand, price, currency, category, item_type, tags")
    .in("id", itemIds)
    .or(`title.ilike.${pattern},brand.ilike.${pattern},category.ilike.${pattern}`)
    .order("updated_at", { ascending: false })
    .limit(MAX_ITEMS);

  if (error) return { error: error.message };

  const items = ((data || []) as Pick<Item, keyof TrimmedItem>[]).map(trimItem);
  return { items, count: items.length, truncated: items.length === MAX_ITEMS };
}

// ── Mutations (run AFTER user approval; authenticated RLS client) ──────────

export async function createCollectionForUser(
  client: AuthedClient,
  input: {
    name: string;
    description?: string;
    visibility: "public" | "private";
    item_ids?: string[];
  }
) {
  const { data: collectionId, error } = await (client as any).rpc(
    "create_user_collection",
    {
      collection_name: input.name.trim(),
      collection_description: input.description?.trim() || null,
      collection_type: null,
      collection_visibility: input.visibility,
    }
  );

  if (error || !collectionId) {
    return { error: error?.message || "Failed to create collection" };
  }

  let added = 0;
  const failed: string[] = [];
  if (input.item_ids?.length) {
    const result = await addItemsToCollectionForUser(client, {
      collection_id: collectionId as string,
      item_ids: input.item_ids,
    });
    if ("error" in result) {
      return { collection_id: collectionId, error: result.error };
    }
    added = result.added;
    failed.push(...(result.failed ?? []));
  }

  return {
    collection_id: collectionId as string,
    name: input.name.trim(),
    visibility: input.visibility,
    items_added: added,
    ...(failed.length ? { failed_item_ids: failed } : {}),
  };
}

export async function addItemsToCollectionForUser(
  client: AuthedClient,
  input: { collection_id: string; item_ids: string[] }
) {
  // RLS-scoped read doubles as the access check (owner or editor can see it)
  const { data: collection } = await client
    .from("collections")
    .select("id, name")
    .eq("id", input.collection_id)
    .single();

  if (!collection) {
    return { error: "Collection not found or you don't have write access." };
  }

  let added = 0;
  let alreadyLinked = 0;
  const failed: string[] = [];

  for (const itemId of input.item_ids) {
    const { error } = await (client as any).from("collection_items").insert({
      collection_id: input.collection_id,
      item_id: itemId,
      notes: null,
      position: null,
    });

    if (!error) added++;
    else if (error.code === "23505") alreadyLinked++;
    else failed.push(itemId);
  }

  return {
    collection_id: input.collection_id,
    added,
    already_linked: alreadyLinked,
    ...(failed.length ? { failed } : {}),
  };
}

export async function removeItemsFromCollectionForUser(
  client: AuthedClient,
  userId: string,
  input: { collection_id: string; item_ids: string[] }
) {
  // Removal is owner-only (matches the internal DELETE route)
  const { data: collection } = await client
    .from("collections")
    .select("id, owner_id")
    .eq("id", input.collection_id)
    .single();

  const owned = collection as { id: string; owner_id: string } | null;
  if (!owned || owned.owner_id !== userId) {
    return { error: "Only the collection owner can remove items." };
  }

  let removed = 0;
  let refiledToInbox = 0;
  const failed: string[] = [];

  for (const itemId of input.item_ids) {
    const { error: deleteError } = await client
      .from("collection_items")
      .delete()
      .eq("collection_id", input.collection_id)
      .eq("item_id", itemId);

    if (deleteError) {
      failed.push(itemId);
      continue;
    }
    removed++;

    // Inbox safety net (same semantics as the internal DELETE route): if the
    // item is no longer in any collection the user owns, re-file it to Inbox.
    const { data: remaining } = await client
      .from("collection_items")
      .select("collection_id, collections!inner(owner_id)")
      .eq("item_id", itemId)
      .eq("collections.owner_id", userId);

    if (!remaining || remaining.length === 0) {
      const { data: inbox } = await client
        .from("collections")
        .select("id")
        .eq("owner_id", userId)
        .eq("type", "inbox")
        .single();

      if (inbox) {
        const { error: inboxError } = await (client as any)
          .from("collection_items")
          .insert({
            collection_id: (inbox as { id: string }).id,
            item_id: itemId,
            notes: null,
            position: null,
          });
        if (!inboxError) refiledToInbox++;
      }
    }
  }

  return {
    collection_id: input.collection_id,
    removed,
    refiled_to_inbox: refiledToInbox,
    ...(failed.length ? { failed } : {}),
  };
}
