import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Trove Public API",
    version: "1.0.0",
    description:
      "REST API for accessing and managing your Trove collections and items. Trove is taste infrastructure — the persistent data layer for things you own, want, and track. Use API keys to connect any AI tool or script to your Trove.",
  },
  servers: [{ url: "https://opentrove.com", description: "Production" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "API key authentication. Generate a key in Settings > Developer. Format: trove_sk_...",
      },
    },
    schemas: {
      Collection: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          type: { type: "string", nullable: true },
          visibility: { type: "string", enum: ["public", "private"] },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      CollectionWithCount: {
        allOf: [
          { $ref: "#/components/schemas/Collection" },
          {
            type: "object",
            properties: { item_count: { type: "integer" } },
          },
        ],
      },
      Item: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          source_url: { type: "string", nullable: true },
          title: { type: "string", nullable: true },
          item_type: { type: "string" },
          brand: { type: "string", nullable: true },
          price: { type: "number", nullable: true },
          currency: { type: "string", nullable: true },
          retailer: { type: "string", nullable: true },
          image_url: { type: "string", nullable: true },
          category: { type: "string", nullable: true },
          tags: {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
          attributes: { type: "object" },
          extraction_status: {
            type: "string",
            enum: ["pending", "processing", "complete", "failed"],
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      CollectionItem: {
        allOf: [
          { $ref: "#/components/schemas/Item" },
          {
            type: "object",
            properties: {
              added_at: { type: "string", format: "date-time" },
              position: { type: "integer", nullable: true },
              notes: { type: "string", nullable: true },
            },
          },
        ],
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/api/v1/collections": {
      get: {
        operationId: "listCollections",
        summary: "List your collections",
        description:
          "Returns all collections owned by the authenticated user, sorted by last updated.",
        responses: {
          "200": {
            description: "List of collections",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    collections: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Collection" },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Authentication failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      post: {
        operationId: "createCollection",
        summary: "Create a collection",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  visibility: {
                    type: "string",
                    enum: ["public", "private"],
                    default: "public",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Collection created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    collection: {
                      $ref: "#/components/schemas/Collection",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/collections/{id}": {
      get: {
        operationId: "getCollection",
        summary: "Get a collection",
        description: "Returns a single collection with its item count.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Collection details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    collection: {
                      $ref: "#/components/schemas/CollectionWithCount",
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Collection not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/v1/collections/{id}/items": {
      get: {
        operationId: "listCollectionItems",
        summary: "List items in a collection",
        description:
          "Returns all items in a collection, sorted by position. Includes collection-specific metadata (notes, position, added_at).",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "List of items with collection metadata",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/CollectionItem",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: "addItemToCollection",
        summary: "Add an item to a collection",
        description:
          "Add an item by URL (triggers async extraction) or by existing item_id. When adding by URL, if the item was previously extracted, it is linked immediately.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "URL to extract and add",
                  },
                  item_id: {
                    type: "string",
                    format: "uuid",
                    description: "Existing item ID to link",
                  },
                  notes: { type: "string" },
                  position: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Existing item linked to collection" },
          "201": { description: "Item added to collection" },
          "202": {
            description:
              "Item created and extraction started. Poll GET /api/v1/items/{id} for status.",
          },
        },
      },
      delete: {
        operationId: "removeItemFromCollection",
        summary: "Remove an item from a collection",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "item_id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Item removed from collection" },
        },
      },
    },
    "/api/v1/collections/{id}/context": {
      get: {
        operationId: "getCollectionContext",
        summary: "Get collection context for AI consumption",
        description:
          "Returns a Markdown + JSON hybrid format optimized for LLM consumption. Only works for public collections.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "level",
            in: "query",
            schema: {
              type: "string",
              enum: ["basic", "full"],
              default: "basic",
            },
          },
        ],
        responses: {
          "200": {
            description: "Markdown context document",
            content: { "text/markdown": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/api/v1/items": {
      post: {
        operationId: "createItem",
        summary: "Create an item from a URL",
        description:
          "Submits a URL for extraction. Returns immediately with a pending status. The extraction happens asynchronously — poll GET /api/v1/items/{id} to check progress.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string", format: "uri" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Item already extracted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    item: { $ref: "#/components/schemas/Item" },
                    status: { type: "string" },
                    is_existing: { type: "boolean" },
                  },
                },
              },
            },
          },
          "202": { description: "Extraction started" },
        },
      },
    },
    "/api/v1/items/{id}": {
      get: {
        operationId: "getItem",
        summary: "Get item details",
        description: "Returns full item details including extraction status.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Item details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    item: { $ref: "#/components/schemas/Item" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Item not found",
          },
        },
      },
    },
    "/api/v1/items/search": {
      get: {
        operationId: "searchItems",
        summary: "Search your items",
        description:
          "Search items across all your collections by title, brand, or category. Returns up to 50 results.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Search query (matches title, brand, category)",
          },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Item" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

/** GET /api/v1/openapi.json — Serve the OpenAPI spec */
export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
